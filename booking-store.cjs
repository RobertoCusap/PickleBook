const { DatabaseSync } = require("node:sqlite");
const { createHash, randomBytes } = require("node:crypto");
const rules = require("./booking-rules.js");

class BookingError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

const requestKeyValid = (key) => typeof key === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(key);

function openBookingStore(file, courts, clock = () => new Date()) {
  const courtMap = new Map(courts.map((court) => [court.id, court]));
  const db = new DatabaseSync(file, { timeout: 5000 });
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS bookings (
      ref TEXT PRIMARY KEY NOT NULL,
      request_key TEXT UNIQUE NOT NULL,
      fingerprint TEXT NOT NULL,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      email_key TEXT NOT NULL,
      phone_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      cancelled_at INTEGER
    ) STRICT;
    CREATE TABLE IF NOT EXISTS booking_slots (
      ref TEXT NOT NULL REFERENCES bookings(ref),
      date TEXT NOT NULL,
      court_id TEXT NOT NULL,
      court_name TEXT NOT NULL,
      start TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price > 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      PRIMARY KEY (ref, court_id, start)
    ) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_hour
      ON booking_slots (date, court_id, start) WHERE active = 1;
    CREATE INDEX IF NOT EXISTS booking_date ON bookings(date);
    CREATE INDEX IF NOT EXISTS recent_email ON bookings(email_key, created_at);
    CREATE INDEX IF NOT EXISTS recent_phone ON bookings(phone_key, created_at);
  `);
  const findRequest = db.prepare("SELECT * FROM bookings WHERE request_key = ?");
  const findBooking = db.prepare("SELECT * FROM bookings WHERE ref = ?");
  const findSlots = db.prepare(`
    SELECT court_id AS courtId, court_name AS courtName, start, price FROM booking_slots
    WHERE ref = ? ORDER BY start, court_id
  `);
  const bookedHours = db.prepare("SELECT court_id AS courtId, start FROM booking_slots WHERE date = ? AND active = 1");
  const recentBookings = db.prepare("SELECT count(*) AS total FROM bookings WHERE created_at >= ? AND (email_key = ? OR phone_key = ?)");
  const insertBooking = db.prepare(`
    INSERT INTO bookings (ref, request_key, fingerprint, date, name, email, phone, email_key, phone_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSlot = db.prepare("INSERT INTO booking_slots (ref, date, court_id, court_name, start, price) VALUES (?, ?, ?, ?, ?, ?)");
  const list = db.prepare("SELECT * FROM bookings WHERE date = ? ORDER BY created_at DESC");
  const cancelBooking = db.prepare("UPDATE bookings SET cancelled_at = ? WHERE ref = ?");
  const releaseHours = db.prepare("UPDATE booking_slots SET active = 0 WHERE ref = ?");

  function transaction(work) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function receipt(booking) {
    const reservations = findSlots.all(booking.ref);
    return {
      ref: booking.ref, date: booking.date, reservations,
      total: reservations.reduce((sum, slot) => sum + slot.price, 0),
      status: booking.cancelled_at === null ? "confirmed" : "cancelled",
    };
  }

  function assertBookableDate(date, now) {
    if (!rules.validDate(date) || date < now.date || date > rules.addDays(now.date, rules.advanceDays)) {
      throw new BookingError(400, "DATE_RANGE", `Choose a date within the next ${rules.advanceDays} days in Manila time.`, { now });
    }
  }

  function availability(date) {
    const instant = clock();
    const now = { ...rules.venueTime(instant), epoch: instant.getTime() };
    assertBookableDate(date, now);
    return { date, now, booked: bookedHours.all(date) };
  }

  function create(input) {
    const { requestKey, date, slots, expectedTotal } = input ?? {};
    if (!requestKeyValid(requestKey) || !rules.validDate(date) || !Array.isArray(slots) || !slots.length ||
        slots.length > rules.maxSlots || !Number.isSafeInteger(expectedTotal) || expectedTotal <= 0) {
      throw new BookingError(400, "INVALID_BOOKING", `Choose between 1 and ${rules.maxSlots} court-hours for one date.`);
    }
    const { customer, errors } = rules.checkCustomer(input.customer);
    if (Object.keys(errors).length) throw new BookingError(400, "INVALID_CONTACT", "Check your contact details.", { errors });
    if (slots.some((slot) => !courtMap.has(slot?.courtId) || !rules.starts.includes(slot.start))) {
      throw new BookingError(400, "INVALID_SLOT", "Choose a listed court and hour.");
    }
    const hours = slots.map(({ courtId, start }) => `${courtId}|${start}`).sort();
    if (new Set(hours).size !== hours.length) throw new BookingError(400, "DUPLICATE_SLOT", "Choose each court-hour once.");
    const key = requestKey.toLowerCase();
    const fingerprint = createHash("sha256").update(JSON.stringify({ date, hours, customer, expectedTotal })).digest("hex");

    return transaction(() => {
      const previous = findRequest.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new BookingError(409, "REQUEST_MISMATCH", "This request already has a reservation.");
        return { replayed: true, receipt: receipt(previous) };
      }
      const instant = clock();
      const now = { ...rules.venueTime(instant), epoch: instant.getTime() };
      assertBookableDate(date, now);
      const occupied = new Set(bookedHours.all(date).map(({ courtId, start }) => `${courtId}|${start}`));
      const conflicts = slots.filter(({ courtId, start }) => rules.slotIsPast(date, start, now) || occupied.has(`${courtId}|${start}`))
        .map(({ courtId, start }) => ({ courtId, start }));
      if (conflicts.length) {
        throw new BookingError(409, "SLOT_UNAVAILABLE", "Some selected court-hours are no longer available. Review your selection and confirm again.", { conflicts });
      }
      const total = slots.reduce((sum, { courtId }) => sum + courtMap.get(courtId).price, 0);
      if (total !== expectedTotal) {
        const rates = Object.fromEntries(courts.map(({ id, price }) => [id, price]));
        throw new BookingError(409, "PRICE_CHANGED", "Court rates changed. Review the updated total before confirming.", { rates });
      }
      const emailKey = customer.email.toLowerCase();
      const phoneKey = customer.phone.replace(/\D/g, "");
      if (recentBookings.get(instant.getTime() - 3_600_000, emailKey, phoneKey).total >= 6) {
        throw new BookingError(429, "BOOKING_LIMIT", "This contact has reached the hourly booking limit. Try again later or contact the facility.");
      }
      const ref = `RC-${randomBytes(8).toString("hex").toUpperCase()}`;
      insertBooking.run(ref, key, fingerprint, date, customer.name, customer.email, customer.phone, emailKey, phoneKey, instant.getTime());
      for (const { courtId, start } of slots) {
        const court = courtMap.get(courtId);
        insertSlot.run(ref, date, courtId, court.name, start, court.price);
      }
      return { replayed: false, receipt: receipt(findBooking.get(ref)) };
    });
  }

  function status(requestKey) {
    if (!requestKeyValid(requestKey)) throw new BookingError(400, "INVALID_REQUEST", "Invalid booking request.");
    const booking = findRequest.get(requestKey.toLowerCase());
    if (!booking) throw new BookingError(404, "BOOKING_NOT_FOUND", "No reservation was found for this request.");
    return receipt(booking);
  }

  function forStaff(date) {
    return list.all(date).map((booking) => {
      const summary = receipt(booking);
      return { ...summary, name: booking.name, email: booking.email, phone: booking.phone,
        canCancel: summary.status === "confirmed" && !rules.slotIsPast(date, summary.reservations[0].start, rules.venueTime(clock())) };
    });
  }

  function cancel(ref) {
    return transaction(() => {
      const booking = findBooking.get(ref);
      if (!booking) throw new BookingError(404, "BOOKING_NOT_FOUND", "Booking not found.");
      if (booking.cancelled_at !== null) return booking.date;
      const instant = clock();
      if (rules.slotIsPast(booking.date, findSlots.all(ref)[0].start, rules.venueTime(instant))) {
        throw new BookingError(409, "BOOKING_STARTED", "The first reserved hour has already started.");
      }
      cancelBooking.run(instant.getTime(), ref);
      releaseHours.run(ref);
      return booking.date;
    });
  }

  return { availability, create, status, forStaff, cancel, close: () => db.close() };
}

module.exports = { openBookingStore, BookingError };
