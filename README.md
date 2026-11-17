# RallyCourt frontend demo

A responsive, frontend-only pickleball booking and facility management demonstration. It uses plain HTML, CSS, and JavaScript with fictional sample data; there is no server, database, authentication, or payment integration.

## Run locally

Open `index.html` in a modern browser, or serve this directory with any static file server (for example, `python -m http.server 8000`) and visit `http://localhost:8000`. or 8001

Run the frontend smoke test with `node --test test/smoke.test.cjs`.

## Demo features

- Public home, court listings, about/contact, and leaderboard pages.
- Multi-step court booking with date, time, duration, validation, overlap checks, a confirmation view, and browser-local demo persistence.
- Leaderboard category/period filters, player search, and profile previews.
- Management dashboard with date filters, booking/revenue/utilization summaries, booking and revenue trends, charts, and sample CSV download.
- Use **Management demo → Reset demo data** to clear browser-local demo bookings.

All venue, player, booking, and analytics information is fictional. A booking confirmation is saved only in local browser storage and is not a real reservation.
