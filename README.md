# RallyCourt

RallyCourt is a pickleball court booking site with a public schedule and a staff bookings page. The live service runs on Node.js 24 and stores reservations in SQLite. It has no third-party runtime packages.

## Booking flow

1. Choose a date and one or more one-hour slots. Use the court and time-of-day filters to browse. Each booking covers one date.
2. Enter a name, email address, and phone number. Review the selected courts, hours, and total in Philippine pesos.
3. Confirm the booking and save the reference shown on screen. Pay at the venue. The application displays the receipt in the browser and does not send email or SMS.

The live schedule uses Manila time. The booking window is today through 60 days ahead, with slots from 7:00 AM to 10:00 PM and up to 12 court-hours per booking. Selections remain available to other customers until confirmation. If any selected hour becomes unavailable, the server saves none of the hours and the page asks the customer to review the remaining selection. Retrying a confirmation with the same request key returns the original booking. The current receipt can be recovered in the same browser tab after a reload.

Staff can open `/staff`, sign in, and view reservations by date. Cancelling an upcoming booking reopens all of its court-hours. Keep court IDs stable when editing the facility configuration, since reservations refer to them. Bookings made through the static demo stay in the browser and are separate from live reservations.

## Preview locally

Run `npm start` and open the printed URL. The preview tries ports 3000 through 3010 unless you set `PORT` explicitly. It uses the same booking API and reads `facility.json` when available or `facility.example.json` otherwise. Test bookings reset when the server stops.

For the preview staff page, set `STAFF_USER` and a local `STAFF_PASSWORD` of at least 20 characters in `.env`. Run `npm test` for the checkout and API tests. Open `index.html` directly for the static demo.

## Run with real facility settings

1. Copy `facility.example.json` to `facility.json` and set the facility name, address, contact email and court rates. Rates are whole Philippine pesos. The server rejects placeholder address and contact values.
2. Create a local `.env` file using the values below and set a unique staff password of at least 20 characters. The `.env` file, `facility.json`, and the default database directory are ignored by Git.

   ```dotenv
   PUBLIC_ORIGIN=http://localhost:3000
   STAFF_USER=staff
   STAFF_PASSWORD=
   ```

3. Run `npm run start:production`. For local testing, open the configured loopback URL using the same hostname and port as `PUBLIC_ORIGIN`. This mode stores bookings in the persistent database. `npm start` also uses this mode when `NODE_ENV` is `production`.

## Deploy the live service

- Run `npm run start:production` in one Node.js 24 service on a host with a writable persistent volume. Set `DB_PATH` to the database file on that volume and `FACILITY_CONFIG` to the configured facility JSON. Do not put SQLite on an ephemeral filesystem or run replicas with independent database files.
- Set `PUBLIC_ORIGIN` to the exact public HTTPS origin without a trailing slash. Route HTTPS through the hosting platform or a reverse proxy. Set `STAFF_USER` and `STAFF_PASSWORD` as runtime secrets and forward the original `Origin` header. Limit repeated requests to `/api/bookings`, `/api/booking-status`, and `/staff*` at the host or proxy. Keep the backend listener private to the proxy where possible.
- For a container deployment, build with `docker build -t rallycourt .`. Start it with a writable persistent volume at `/app/data`, mount the facility JSON read-only at `/app/facility.json`, and provide the runtime environment values. The container listens on port `3000` and uses `/healthz` for its health check.
- Use SQLite-consistent backups of the booking database and secure them with the same access restrictions as the live volume. Keep customer details accessible only to staff who manage bookings. Before opening to customers, verify the address, court rates and payment arrangements, then place and cancel a staging booking through the host’s HTTPS URL.
