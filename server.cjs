const { createServer } = require("node:http");
const { createHash, timingSafeEqual } = require("node:crypto");
const { existsSync, readFileSync, mkdirSync } = require("node:fs");
const { join, dirname, resolve } = require("node:path");
const { openBookingStore, BookingError } = require("./booking-store.cjs");
const rules = require("./booking-rules.js");

const assets = new Map([
  ["/", ["index.html", "text/html"]],
  ["/app.js", ["app.js", "text/javascript"]],
  ["/styles.css", ["styles.css", "text/css"]],
  ["/mock-data.js", ["mock-data.js", "text/javascript"]],
  ["/booking-rules.js", ["booking-rules.js", "text/javascript"]],
]);
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const digest = (value) => createHash("sha256").update(value).digest();
const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function validateFacility(facility, preview) {
  const { name, location, email, courts } = facility ?? {};
  const text = (value) => typeof value === "string" && value.trim() && value.length <= 160;
  if (!text(name)) throw new Error('Set "name" in the facility configuration.');
  const placeholderLocation = typeof location === "string" && /replace with/i.test(location);
  if (!text(location) || (!preview && placeholderLocation)) throw new Error('Set "location" to the facility’s street address.');
  if (!text(email) || !/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(email) || (!preview && /@example\.(com|org|net)$/i.test(email))) {
    throw new Error('Set "email" to the facility’s booking contact address.');
  }
  if (!Array.isArray(courts) || !courts.length || courts.length > 30) throw new Error('List 1 to 30 courts under "courts".');
  const ids = new Set();
  for (const [index, court] of courts.entries()) {
    const label = `Court ${index + 1}`;
    if (typeof court?.id !== "string" || !/^[a-z0-9-]{1,32}$/.test(court.id) || ids.has(court.id)) {
      throw new Error(`${label} needs a unique ID using up to 32 lowercase letters, digits, or hyphens.`);
    }
    if (!text(court.name) || !text(court.surface) || !["Indoor", "Outdoor"].includes(court.type)) {
      throw new Error(`${label} needs a name, surface, and a type of Indoor or Outdoor.`);
    }
    if (!Number.isSafeInteger(court.price) || court.price < 1 || court.price > 100000) {
      throw new Error(`${label} needs an hourly price in whole pesos between 1 and 100,000.`);
    }
    ids.add(court.id);
  }
  return {
    name, location: placeholderLocation ? "Sample facility, Manila" : location, email,
    courts: courts.map(({ id, name, type, surface, price }) => ({ id, name, type, surface, price })),
  };
}

async function readBody(request, type) {
  if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== type) {
    throw new BookingError(415, "CONTENT_TYPE", "Unsupported content type.");
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > 8192) {
      request.resume();
      throw new BookingError(413, "REQUEST_SIZE", "Request is too large.");
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks, bytes).toString("utf8");
  if (type !== "application/json") return new URLSearchParams(body);
  try { return JSON.parse(body); }
  catch { throw new BookingError(400, "INVALID_JSON", "Invalid request body."); }
}

function staffPage(facility, date, rows, notice) {
  const bookings = rows.map((row) => `<article class="staff-booking"><div class="staff-booking-heading"><h2>${escape(row.ref)}</h2><strong>${row.status === "confirmed" ? "Confirmed" : "Cancelled"}</strong></div>
    <p><strong>${escape(row.name)}</strong><br>${escape(row.email)} · ${escape(row.phone)}</p>
    <ul>${row.reservations.map((slot) => `<li>${escape(slot.courtName)} · ${slot.start}–${String(Number(slot.start.slice(0, 2)) + 1).padStart(2, "0")}:00</li>`).join("")}</ul>
    <p>${money.format(row.total)} · Pay at the venue</p>
    ${row.canCancel ? `<form method="post" action="/staff/cancel"><input type="hidden" name="ref" value="${escape(row.ref)}"><label><input type="checkbox" name="agree" value="1" required> Release all hours in this booking</label> <button class="button button-quiet" type="submit">Cancel booking</button></form>` : ""}</article>`).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Staff bookings</title><link rel="stylesheet" href="/styles.css"><main class="page-wrap staff-page"><a href="/">${escape(facility.name)} home</a><h1>Staff bookings</h1><p>All dates and times use Manila time.</p>
    <form class="staff-date" method="get" action="/staff"><label for="staff-date">Booking date</label><input id="staff-date" name="date" type="date" value="${date}" required><button class="button button-primary">Show bookings</button></form>
    ${notice ? '<p role="status">Booking cancelled. Its court-hours are available again.</p>' : ""}${bookings || "<p>No bookings for this date.</p>"}</main></html>`;
}

function createBookingServer({ dbPath, origin, facility, staffUser, staffPassword, preview = false, clock = () => new Date() }) {
  facility = validateFacility(facility, preview);
  const publicUrl = URL.parse(origin);
  const localHttp = publicUrl?.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(publicUrl.hostname);
  if (preview && !localHttp) throw new Error("Local preview requires a loopback HTTP origin.");
  if (!publicUrl || publicUrl.origin !== origin || (publicUrl.protocol !== "https:" && !localHttp)) {
    throw new Error("PUBLIC_ORIGIN must be an HTTPS origin, or a loopback HTTP origin for local testing.");
  }
  const staffAvailable = typeof staffUser === "string" && /^[!-~]+$/.test(staffUser) && !staffUser.includes(":") &&
    typeof staffPassword === "string" && staffPassword.length >= 20;
  if (!preview && !staffAvailable) {
    throw new Error("Set STAFF_USER and a unique STAFF_PASSWORD of at least 20 characters.");
  }
  const staffCredential = staffAvailable ? digest(`Basic ${Buffer.from(`${staffUser}:${staffPassword}`).toString("base64")}`) : null;
  const runtime = `window.RALLY_CONFIG = ${JSON.stringify({ mode: "live", facility, preview, staffAvailable }).replace(/</g, "\\u003c")};`;
  const content = new Map([...assets].map(([path, [file, type]]) => [path, [readFileSync(join(__dirname, file)), type]]));
  if (!preview && dbPath !== ":memory:") mkdirSync(dirname(resolve(dbPath)), { recursive: true, mode: 0o700 });
  const store = openBookingStore(preview ? ":memory:" : dbPath, facility.courts, clock);

  const server = createServer({ requestTimeout: 15000, headersTimeout: 10000, maxHeaderSize: 8192 }, async (request, response) => {
    const method = request.method;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("X-Robots-Tag", "noindex");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https://images.unsplash.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (publicUrl.protocol === "https:") response.setHeader("Strict-Transport-Security", "max-age=31536000");
    function send(status, body, type = "text/plain") {
      response.writeHead(status, { "Content-Type": `${type}; charset=utf-8` });
      response.end(method === "HEAD" ? undefined : body);
    }
    const json = (status, body) => send(status, JSON.stringify(body), "application/json");
    let api = false;
    try {
      const url = new URL(request.url, origin);
      const path = url.pathname;
      api = path.startsWith("/api/");
      if (url.origin !== origin) return send(400, "Invalid request.");
      if (method === "POST" && request.headers.origin !== origin) return send(403, "Request origin is not allowed.");

      if (path === "/staff" || path === "/staff/cancel") {
        if (!staffCredential) return send(503, "For local staff access, set STAFF_USER and STAFF_PASSWORD in .env and restart. The password must have at least 20 characters.");
        if (!timingSafeEqual(digest(request.headers.authorization ?? ""), staffCredential)) {
          response.setHeader("WWW-Authenticate", 'Basic realm="RallyCourt staff", charset="UTF-8"');
          return send(401, "Staff credentials required.");
        }
        if (method === "GET" && path === "/staff") {
          const date = url.searchParams.get("date") ?? rules.venueTime(clock()).date;
          if (!rules.validDate(date)) return send(400, "Choose a valid booking date.");
          return send(200, staffPage(facility, date, store.forStaff(date), url.searchParams.get("cancelled") === "1"), "text/html");
        }
        if (method === "POST" && path === "/staff/cancel") {
          const body = await readBody(request, "application/x-www-form-urlencoded");
          if (body.get("agree") !== "1") return send(400, "Confirm that all booked hours should be released.");
          const date = store.cancel(body.get("ref"));
          response.writeHead(303, { Location: `/staff?date=${date}&cancelled=1` });
          return response.end();
        }
        return send(405, "Method not allowed.");
      }

      if (method === "GET" && path === "/api/availability") return json(200, store.availability(url.searchParams.get("date")));
      if (method === "POST" && path === "/api/bookings") {
        const result = store.create(await readBody(request, "application/json"));
        return json(result.replayed ? 200 : 201, result.receipt);
      }
      if (method === "POST" && path === "/api/booking-status") {
        const body = await readBody(request, "application/json");
        return json(200, store.status(body?.requestKey));
      }
      if (["GET", "HEAD"].includes(method)) {
        if (path === "/healthz") return send(200, "ok");
        if (path === "/runtime-config.js") return send(200, runtime, "text/javascript");
        if (content.has(path)) {
          if (path === "/" && !preview) response.removeHeader("X-Robots-Tag");
          return send(200, ...content.get(path));
        }
      }
      return api ? json(404, { code: "NOT_FOUND", message: "Endpoint not found." }) : send(404, "Page not found.");
    } catch (error) {
      if (error instanceof BookingError) {
        return api ? json(error.status, { code: error.code, message: error.message, ...error.details }) : send(error.status, error.message);
      }
      console.error("Booking server request failed", error.code ?? error.name);
      return api ? json(500, { code: "SERVER_ERROR", message: "Booking service is temporarily unavailable." }) : send(500, "Service unavailable.");
    }
  });
  server.once("close", store.close);
  return server;
}

function startFromEnvironment() {
  const { PUBLIC_ORIGIN, STAFF_USER, STAFF_PASSWORD, FACILITY_CONFIG, DB_PATH = "data/bookings.sqlite", HOST = "127.0.0.1", PORT, NODE_ENV } = process.env;
  const preview = process.argv.includes("--preview") && NODE_ENV !== "production";
  const port = Number(PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
  const configPath = FACILITY_CONFIG || (preview && !existsSync("facility.json") ? join(__dirname, "facility.example.json") : "facility.json");
  let facility;
  try { facility = JSON.parse(readFileSync(configPath, "utf8").replace(/^\uFEFF/, "")); }
  catch (error) {
    if (error.code === "ENOENT") throw new Error(`Facility configuration file not found at ${configPath}. See README.md for setup.`);
    if (error instanceof SyntaxError) throw new Error(`Facility configuration in ${configPath} must be valid JSON.`);
    throw error;
  }

  function listen(listenPort) {
    const origin = preview ? new URL(`http://127.0.0.1:${listenPort}`).origin : PUBLIC_ORIGIN;
    const server = createBookingServer({ dbPath: DB_PATH, origin, facility, staffUser: STAFF_USER, staffPassword: STAFF_PASSWORD, preview });
    server.once("error", (error) => {
      server.close();
      if (preview && PORT === undefined && error.code === "EADDRINUSE" && listenPort < 3010) {
        listen(listenPort + 1);
        return;
      }
      console.error(`RallyCourt could not listen on port ${listenPort}. ${error.code === "EADDRINUSE" ? "Set PORT to an available port." : error.message}`);
      process.exitCode = 1;
    });
    server.listen(listenPort, preview ? "127.0.0.1" : HOST, () => {
      console.log(preview ? `RallyCourt local preview at ${origin} (bookings reset on restart)` : `RallyCourt listening on port ${listenPort}. Open ${origin}`);
      for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
    });
  }
  listen(port);
}

if (require.main === module) {
  try { startFromEnvironment(); }
  catch (error) {
    console.error(`RallyCourt could not start. ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { createBookingServer };
