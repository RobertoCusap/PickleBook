const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createDemo() {
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
        setSelectionRange() {}, click() {}, selectionStart: 0,
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
  };
  class FormDataMock {
    constructor(form) { this.form = form; }
    get(name) { return this.form.fields[name]; }
  }
  const context = vm.createContext({
    window, document, location, localStorage, URLSearchParams, Intl, Date, Math,
    Number, String, Array, JSON, Blob, FormData: FormDataMock,
    setTimeout: () => 0, confirm: () => true, console,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  });
  const root = path.resolve(__dirname, "..");
  vm.runInContext(fs.readFileSync(path.join(root, "mock-data.js"), "utf8"), context);
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
  navigate("#courts");
  assert.match(app.innerHTML, /The Center Court/);
  assert.match(app.innerHTML, /Outdoor/);
  navigate("#about");
  assert.match(app.innerHTML, /fictional neighborhood pickleball club/i);

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
  dispatch("click", "[data-range]", { dataset: { range: "week" } });
  assert.match(app.innerHTML, /This week/);

  navigate("#book?court=c1");
  assert.match(app.innerHTML, /booking-court-option selected/);
  dispatch("click", "[data-next-step]", { dataset: { nextStep: "2" }, disabled: false });
  assert.match(app.innerHTML, /Find a time to play/);
  const date = data.dateOffset(8);
  dispatch("change", "booking-date", { id: "booking-date", value: date });
  dispatch("click", "[data-duration]", { dataset: { duration: "1.5" } });
  dispatch("click", "[data-start]", { dataset: { start: "07:00" } });
  dispatch("click", "[data-next-step]", { dataset: { nextStep: "3" }, disabled: false });
  const form = {
    id: "customer-form", reportValidity: () => true,
    fields: { name: "Jamie Parker", email: "jamie@example.test", phone: "555-010-1234" },
  };
  handlers.document.submit({ target: form, preventDefault() {} });
  assert.match(app.innerHTML, /Review your game/);
  assert.match(app.innerHTML, /7:00 AM – 8:30 AM/);
  assert.match(app.innerHTML, /\$48/);
  dispatch("click", "[data-confirm-booking]");
  assert.match(app.innerHTML, /DEMO BOOKING COMPLETE/);
  assert.match(app.innerHTML, /RC-[A-Z0-9]{6}/);

  const saved = JSON.parse(storage.get("rallycourt-demo-bookings-v1"));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].date, date);
  assert.equal(saved[0].duration, 1.5);
  assert.equal(saved[0].name, undefined);
  assert.equal(saved[0].email, undefined);

  dispatch("click", "[data-book-another]");
  navigate("#courts");
  navigate("#book");
  dispatch("click", "[data-select-court]", { dataset: { selectCourt: "c1" } });
  dispatch("click", "[data-next-step]", { dataset: { nextStep: "2" }, disabled: false });
  dispatch("change", "booking-date", { id: "booking-date", value: date });
  dispatch("click", "[data-duration]", { dataset: { duration: "1.5" } });
  assert.doesNotMatch(app.innerHTML, /data-start="07:00"/);
  assert.doesNotMatch(app.innerHTML, /data-start="08:00"/);
});
