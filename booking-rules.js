((rules) => {
  if (typeof module === "object" && module.exports) module.exports = rules;
  else window.RALLY_RULES = rules;
})((() => {
  const timeZone = "Asia/Manila";
  const openHour = 7;
  const closeHour = 22;
  const advanceDays = 60;
  const maxSlots = 12;
  const starts = Array.from({ length: closeHour - openHour }, (_, index) =>
    `${String(openHour + index).padStart(2, "0")}:00`
  );
  const venueFormat = new Intl.DateTimeFormat("en-PH", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });

  function venueTime(now = new Date()) {
    const parts = Object.fromEntries(venueFormat.formatToParts(now).map(({ type, value }) => [type, value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }

  function addDays(date, amount) {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0, 10);
  }

  function validDate(date) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }

  function slotIsPast(date, start, now) {
    return date < now.date || (date === now.date && start <= now.time);
  }

  function checkCustomer(value) {
    const customer = Object.fromEntries(["name", "email", "phone"].map((field) => [field,
      typeof value?.[field] === "string" ? value[field].trim() : "",
    ]));
    const errors = {};
    if (customer.name.length < 2 || customer.name.length > 100 || /[\x00-\x1f\x7f]/.test(customer.name)) {
      errors.name = "Enter a name between 2 and 100 characters.";
    }
    if (customer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      errors.email = "Enter a valid email address.";
    }
    if (!/^\+?[\d ().-]+$/.test(customer.phone) || customer.phone.length > 32 ||
        !/^\d{7,15}$/.test(customer.phone.replace(/\D/g, ""))) {
      errors.phone = "Enter a phone number with 7 to 15 digits, including the country code if needed.";
    }
    return { customer, errors };
  }

  return { timeZone, openHour, closeHour, starts, advanceDays, maxSlots, venueTime, addDays, validDate, slotIsPast, checkCustomer };
})());
