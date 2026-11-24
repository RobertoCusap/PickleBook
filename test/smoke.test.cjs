const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { setImmediate } = require("node:timers/promises");

function createDemo(live) {
  const fixedNow = Date.parse("2026-11-24T09:15:00Z");
  const FixedDate = class extends Date {
    constructor(...args) { super(...(args.length ? args : [fixedNow])); }
    static now() { return fixedNow; }
  };
  const handlers = { document: {}, window: {} };
  const storage = new Map();
  const elements = new Map();
  const classList = () => ({
    add() {}, remove() {}, toggle() {}, contains() { return false; },
  });
  const element = (selector) => {
    if (!elements.has(selector)) {
      elements.set(selector, {
        selector, innerHTML: "", value: "", dataset: {}, disabled: false,
        classList: classList(), setAttribute() {}, focus() {},
        setSelectionRange() {}, click() {}, remove() {}, selectionStart: 0,
      });
    }
    return elements.get(selector);
  };
  const document = {
    body: { classList: classList() },
    querySelector: element,
    querySelectorAll: () => [],
    addEventListener: (name, handler) => { handlers.document[name] = handler; },
    createElement: (tag) => ({ tag, click() {} }),
  };
  const location = { hash: "" };
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const window = {
    addEventListener: (name, handler) => { handlers.window[name] = handler; },
    scrollTo() {},
    crypto: require("node:crypto").webcrypto,
  };
  class FormDataMock {
    constructor(form) { this.form = form; }
    get(name) { return this.form.fields[name]; }
  }
  const context = vm.createContext({
    window, document, location, localStorage, URLSearchParams, Intl, Date: FixedDate, Math,
    Number, String, Array, JSON, Blob, FormData: FormDataMock,
    sessionStorage: live?.sessionStorage, fetch: live?.fetch, AbortSignal,
    setTimeout: () => 0, confirm: () => true, console,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  });
  const root = path.resolve(__dirname, "..");
  for (const script of ["runtime-config.js", "booking-rules.js", "mock-data.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, script), "utf8"), context);
  }
  if (live) window.RALLY_CONFIG = { mode: "live", facility: { ...live.facility, courts: window.RALLY_DATA.courts } };
  vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context);

  let targetInstance;
  const dispatch = (type, selector, props = {}) => {
    targetInstance = { ...props };
    const selectors = Array.isArray(selector) ? selector : [selector];
    targetInstance.closest = (query) => selectors.includes(query) ? targetInstance : null;
    targetInstance.setSelectionRange = () => {};
    targetInstance.focus = () => {};
    targetInstance.selectionStart ??= 0;
    const event = {
      target: targetInstance, preventDefault() {},
      key: props.key, metaKey: false, ctrlKey: false,
    };
    handlers.document[type](event);
    return targetInstance;
  };
  const navigate = (hash) => {
    location.hash = hash;
    handlers.window.hashchange();
  };
  return { app: element("#app"), element, dispatch, navigate, storage, context, handlers };
}

test("public pages, booking flow, overlap protection, leaderboard, and dashboard work", () => {
  const demo = createDemo();
  const { app, dispatch, navigate, storage, context, handlers } = demo;
  const data = context.window.RALLY_DATA;

  assert.match(app.innerHTML, /More play\./);
  assert.match(app.innerHTML, /Less admin\./);
  assert.match(app.innerHTML, /See the owner dashboard/);
  navigate("#courts");
  assert.match(app.innerHTML, /The Center Court/);
  assert.match(app.innerHTML, /Outdoor/);
  navigate("#about");
  assert.match(app.innerHTML, /fictional pickleball club/i);

  navigate("#leaderboard");
  assert.match(app.innerHTML, /THE CLUB LEADERBOARD/);
  assert.match(app.innerHTML, /Maya Chen/);
  assert.match(app.innerHTML, /data-player="p4"/);
  dispatch("click", "[data-player]", { dataset: { player: "p4" } });
  assert.match(demo.element("#modal-root").innerHTML, /Alex Morgan/);
  dispatch("click", [".modal-backdrop", "[data-close-modal]"]);
  assert.equal(demo.element("#modal-root").innerHTML, "");

  navigate("#management");
  assert.match(app.innerHTML, /DEMO DASHBOARD/);
  assert.match(app.innerHTML, /Download sample CSV/);
  assert.match(app.innerHTML, /Revenue trend/);
  dispatch("click", "[data-range]", { dataset: { range: "week" } });
  assert.match(app.innerHTML, /This week/);

  navigate("#book");
  assert.match(app.innerHTML, /Choose a date and court time/);
  assert.match(app.innerHTML, /₱400/);
  const slotButton = (key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return app.innerHTML.match(new RegExp(`<button[^>]*data-booking-slot="${escaped}"[^>]*>`))?.[0] || "";
  };
  assert.match(slotButton("c2|16:00"), /disabled/);
  assert.match(slotButton("c2|17:00"), /disabled/);
  assert.doesNotMatch(slotButton("c2|18:00"), /disabled/);

  const date = data.dateOffset(8);
  dispatch("change", "booking-date", { id: "booking-date", value: date });
  for (const courtId of ["c1", "c2", "c3", "c4"]) {
    dispatch("click", "[data-booking-slot]", { dataset: { bookingSlot: `${courtId}|07:00` }, disabled: false });
  }
  assert.match(app.innerHTML, /schedule-slot selected/);
  assert.match(app.innerHTML, /1,600/);
  assert.match(app.innerHTML, /4 court-hours selected/);
  dispatch("change", "booking-date", { id: "booking-date", value: data.dateOffset(9) });
  assert.doesNotMatch(app.innerHTML, /4 court-hours selected/);
  dispatch("change", "booking-date", { id: "booking-date", value: date });
  assert.match(app.innerHTML, /4 court-hours selected/);
  dispatch("click", "[data-remove-slot]", { dataset: { removeSlot: "c4|07:00" } });
  assert.match(app.innerHTML, /3 court-hours selected/);
  dispatch("click", "[data-booking-slot]", { dataset: { bookingSlot: "c4|07:00" }, disabled: false });
  dispatch("click", "[data-next-step]", { dataset: { nextStep: "2" }, disabled: false });
  assert.match(app.innerHTML, /Who's playing/);
  const form = { id: "customer-form", fields: { name: "Jamie Parker", email: "invalid", phone: "555-010-1234" } };
  handlers.document.submit({ target: form, preventDefault() {} });
  assert.match(app.innerHTML, /Enter a valid email address/);
  form.fields.email = "jamie@example.test";
  handlers.document.submit({ target: form, preventDefault() {} });
  assert.match(app.innerHTML, /Review your booking/);
  assert.match(app.innerHTML, /Jamie Parker/);
  assert.match(app.innerHTML, /1,600/);
  dispatch("click", "[data-confirm-booking]");
  assert.match(app.innerHTML, /Demo booking complete/);
  assert.match(app.innerHTML, /RC-[A-Z0-9]{6}/);
  assert.match(app.innerHTML, /1,600/);

  const saved = JSON.parse(storage.get("rallycourt-demo-bookings-v2"));
  assert.equal(saved.length, 4);
  assert.ok(saved.every((row) => row.date === date && row.duration === 1));
  assert.equal(saved[0].name, undefined);
  assert.equal(saved[0].email, undefined);

  dispatch("click", "[data-book-another]");
  navigate("#book?court=c1");
  assert.match(app.innerHTML, /value="c1" selected/);
  assert.equal(slotButton("c2|07:00"), "");
  dispatch("change", "booking-date", { id: "booking-date", value: date });
  assert.match(slotButton("c1|07:00"), /disabled/);
  dispatch("change", "schedule-court", { id: "schedule-court", value: "all" });
  dispatch("change", "booking-date", { id: "booking-date", value: data.dateOffset(1) });
  assert.match(slotButton("c3|18:00"), /disabled/);
  assert.match(slotButton("c4|13:00"), /disabled/);
});

test("live checkout preserves the request key when confirmation is interrupted and restores the receipt", async () => {
  const keys = [];
  const storage = new Map();
  const slot = { courtId: "c1", start: "19:00", price: 400, courtName: "The Center Court" };
  const date = "2026-11-24";
  const receipt = { ref: "RC-000012345678ABCD", date, status: "confirmed", total: 400, reservations: [slot] };
  const live = {
    facility: { name: "Test RallyCourt", location: "Test Court, Manila", email: "bookings@rallycourt.test" },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    async fetch(pathname, options) {
      const body = options.body && JSON.parse(options.body);
      if (pathname.startsWith("/api/availability?")) {
        return Response.json({ date, booked: [], now: { epoch: Date.parse("2026-11-24T09:15:00Z") } });
      }
      if (pathname === "/api/bookings") {
        keys.push(body.requestKey);
        if (keys.length === 1) throw new TypeError("Connection interrupted");
        return Response.json(receipt);
      }
      assert.equal(pathname, "/api/booking-status");
      assert.equal(body.requestKey, keys[0]);
      return Response.json(receipt);
    },
  };
  const { app, dispatch, navigate, handlers } = createDemo(live);
  navigate("#book?court=c1");
  await setImmediate();
  dispatch("click", "[data-booking-slot]", { dataset: { bookingSlot: "c1|19:00" } });
  dispatch("click", "[data-next-step]");
  handlers.document.submit({ target: { id: "customer-form", fields: { name: "Jamie Parker", email: "jamie@example.test", phone: "555-010-1234" } }, preventDefault() {} });
  dispatch("click", "[data-confirm-booking]");
  await setImmediate();
  assert.match(app.innerHTML, /Retry confirmation/);
  assert.deepEqual([...storage.values()], [keys[0]]);
  dispatch("click", "[data-confirm-booking]");
  await setImmediate();
  assert.deepEqual(keys, [keys[0], keys[0]]);
  assert.match(app.innerHTML, /Booking confirmed/);
  assert.match(app.innerHTML, /RC-000012345678ABCD/);
  const reloaded = createDemo(live);
  reloaded.navigate("#book");
  await setImmediate();
  assert.match(reloaded.app.innerHTML, /RC-000012345678ABCD/);
});
