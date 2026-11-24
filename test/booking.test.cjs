const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const { once } = require("node:events");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createBookingServer } = require("../server.cjs");

test("sample settings work for local preview and fail validation in production", async () => {
  const facility = require("../facility.example.json");
  const date = "2026-11-25";
  const options = { origin: "http://127.0.0.1", facility, clock: () => new Date("2026-11-25T00:00:00Z") };
  assert.throws(() => createBookingServer(options), /Set "location"/);
  assert.throws(() => createBookingServer({ ...options, preview: true, origin: "https://rallycourt.test" }), /loopback/);
  const server = createBookingServer({ ...options, preview: true }).listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const settings = await (await fetch(`${base}/runtime-config.js`)).text();
    assert.match(settings, /"preview":true/);
    assert.match(settings, /"location":"Sample facility, Manila"/);
    assert.match(settings, /"staffAvailable":false/);
    assert.equal((await fetch(`${base}/staff`)).status, 503);
    const result = await fetch(`${base}/api/bookings`, {
      method: "POST", headers: { Origin: options.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ requestKey: randomUUID(), date, slots: [{ courtId: "c1", start: "09:00" }], expectedTotal: 400,
        customer: { name: "Test Player", email: "player@rallycourt.test", phone: "09171234567" } }),
    });
    assert.equal(result.status, 201);
  } finally {
    const stopped = once(server, "close");
    server.close();
    await stopped;
  }
});

test("live booking validates, commits all hours once, survives restart, and releases cancellations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rallycourt-test-"));
  const origin = "http://127.0.0.1";
  const staffPassword = randomBytes(24).toString("hex");
  const facility = {
    name: "Test Pickleball", location: "1 Test Court, Manila", email: "staff@rallycourt.test",
    courts: [
      { id: "c1", name: "Court One", surface: "Acrylic", type: "Indoor", price: 400 },
      { id: "c2", name: "Court Two", surface: "Acrylic", type: "Outdoor", price: 550 },
    ],
  };
  let now = new Date("2026-11-24T15:59:00Z");
  const options = { dbPath: join(dir, "bookings.sqlite"), origin, staffUser: "staff", staffPassword, facility, clock: () => now };
  const auth = `Basic ${Buffer.from(`staff:${staffPassword}`).toString("base64")}`;
  let server;
  let baseUrl;
  async function start() {
    server = createBookingServer(options).listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    const stopped = once(server, "close");
    server.close();
    await stopped;
  }
  const get = (path, headers) => fetch(baseUrl + path, { headers });
  const submit = (path, input) => fetch(baseUrl + path, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  const availability = (date) => get(`/api/availability?date=${date}`);
  const customer = { name: "Jamie Parker", email: "jamie@rallycourt.test", phone: "+63 917 123 4567" };
  const date = "2026-11-25";
  const slot = { courtId: "c1", start: "07:00" };
  const free = { courtId: "c2", start: "21:00" };
  const input = { date, customer, expectedTotal: 400, slots: [slot], requestKey: randomUUID() };

  try {
    await start();
    assert.equal((await get("/healthz")).status, 200);
    assert.match(await (await get("/runtime-config.js")).text(), /"mode":"live"/);
    assert.equal((await get("/facility.json")).status, 404);
    assert.equal((await get("/staff")).status, 401);
    assert.equal((await availability("2026-11-24")).status, 200);
    now = new Date("2026-11-24T16:00:00Z");
    const expired = await availability("2026-11-24");
    assert.equal(expired.status, 400);
    assert.equal((await expired.json()).now.date, date);
    assert.equal((await availability("2026-02-30")).status, 400);
    assert.equal((await availability("2027-01-24")).status, 200);
    assert.equal((await availability("2027-01-25")).status, 400);

    const invalidForms = [
      [{ ...input, customer: { ...customer, email: "wrong" } }, "INVALID_CONTACT"],
      [{ ...input, slots: [slot, slot] }, "DUPLICATE_SLOT"],
      [{ ...input, slots: [{ ...slot, start: "22:00" }] }, "INVALID_SLOT"],
      [{ ...input, expectedTotal: 1 }, "PRICE_CHANGED"],
    ];
    for (const [payload, code] of invalidForms) {
      assert.equal((await (await submit("/api/bookings", payload)).json()).code, code);
    }
    const past = await submit("/api/bookings", { ...input, date: "2026-11-24" });
    assert.equal(past.status, 400);
    assert.deepEqual((await (await availability(date)).json()).booked, []);

    const competingKey = randomUUID();
    const requests = await Promise.all([
      submit("/api/bookings", input),
      submit("/api/bookings", { ...input, requestKey: competingKey }),
    ]);
    assert.deepEqual(requests.map((response) => response.status).sort(), [201, 409]);
    const wonKey = requests[0].status === 201 ? input.requestKey : competingKey;
    const receipt = await requests.find((response) => response.status === 201).json();
    assert.equal(receipt.total, 400);
    assert.deepEqual(receipt.reservations, [{ ...slot, courtName: "Court One", price: 400 }]);
    assert.equal(receipt.email, undefined);
    assert.equal((await requests.find((response) => response.status === 409).json()).code, "SLOT_UNAVAILABLE");
    const partial = await submit("/api/bookings", { ...input, requestKey: randomUUID(), slots: [free, slot], expectedTotal: 950 });
    assert.equal(partial.status, 409);
    assert.deepEqual((await partial.json()).conflicts, [slot]);
    assert.deepEqual((await (await availability(date)).json()).booked, [slot]);

    await stop();
    await start();
    const retry = await submit("/api/bookings", { ...input, requestKey: wonKey });
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), receipt);
    const mismatch = await submit("/api/bookings", { ...input, requestKey: wonKey, slots: [free], expectedTotal: 550 });
    assert.equal((await mismatch.json()).code, "REQUEST_MISMATCH");
    const status = await submit("/api/booking-status", { requestKey: wonKey });
    assert.deepEqual(await status.json(), receipt);
    const publicSlots = await availability(date);
    assert.doesNotMatch(await publicSlots.text(), /Jamie|rallycourt\.test|RC-/);
    const staff = await get(`/staff?date=${date}`, { Authorization: auth });
    assert.equal(staff.status, 200);
    assert.match(await staff.text(), /Jamie Parker/);

    const cancel = () => fetch(`${baseUrl}/staff/cancel`, {
      method: "POST", headers: { Origin: origin, Authorization: auth },
      body: new URLSearchParams({ ref: receipt.ref, agree: "1" }), redirect: "manual",
    });
    assert.equal((await cancel()).status, 303);
    assert.equal((await cancel()).status, 303);
    assert.equal((await (await submit("/api/booking-status", { requestKey: wonKey })).json()).status, "cancelled");
    assert.deepEqual((await (await availability(date)).json()).booked, []);
    const rebook = await submit("/api/bookings", { ...input, requestKey: randomUUID(), slots: [slot, free], expectedTotal: 950 });
    assert.equal(rebook.status, 201);
    assert.equal((await rebook.json()).total, 950);

    now = new Date("2026-11-24T23:00:00Z");
    const atStart = await submit("/api/bookings", { ...input, requestKey: randomUUID(), slots: [{ ...slot, courtId: "c2" }], expectedTotal: 550 });
    assert.equal(atStart.status, 409);
    assert.equal((await atStart.json()).code, "SLOT_UNAVAILABLE");
  } finally {
    if (server?.listening) await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
