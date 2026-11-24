(() => {
  "use strict";
  const app = document.querySelector("#app");
  const modalRoot = document.querySelector("#modal-root");
  const toastRoot = document.querySelector("#toast-root");
  const config = window.RALLY_CONFIG;
  if (!config || !["demo", "live"].includes(config.mode) || !window.RALLY_RULES) {
    app.textContent = "RallyCourt is temporarily unavailable. Please reload the page to try again.";
    return;
  }
  const live = config.mode === "live";
  const preview = live && config.preview;
  const facility = config.facility;
  const D = live ? { courts: facility.courts, reservations: [], players: [] } : window.RALLY_DATA;
  const rules = window.RALLY_RULES;
  const STORAGE_KEY = "rallycourt-demo-bookings-v2";
  const REQUEST_KEY = "rallycourt-active-reservation";
  const VENUE_TIME_ZONE = rules.timeZone;
  const priceFormat = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
  const money = (n) => priceFormat.format(n);
  const venueDateKey = (date = new Date()) => rules.venueTime(date).date;
  const addDays = rules.addDays;
  const weekStartFor = (date) => {
    const value = new Date(`${date}T12:00:00Z`);
    const day = (value.getUTCDay() + 6) % 7;
    return addDays(date, -day);
  };
  const dateFmt = (date, options = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-PH", { ...options, timeZone: VENUE_TIME_ZONE });
  const clock = (value) => {
    const [h, m] = value.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  const clockFromHour = (value) => {
    const h = Math.floor(value);
    const minutes = Math.round((value - h) * 60);
    return clock(`${String(h).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
  };
  const hourValue = (value) => {
    const [h, m] = value.split(":").map(Number);
    return h + m / 60;
  };
  const getSavedBookings = () => {
    if (live) return [];
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("rallycourt-demo-bookings-v1") ?? "[]");
      return Array.isArray(saved) ? saved.filter((row) =>
        row && D.courts.some((court) => court.id === row.courtId) &&
        rules.validDate(row.date) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.start) &&
        Number.isFinite(Number(row.duration)) && Number(row.duration) > 0 && row.status === "confirmed"
      ) : [];
    } catch { return []; }
  };
  const readRequestKey = () => {
    try { return sessionStorage.getItem(REQUEST_KEY); }
    catch { return null; }
  };
  function setRequestKey(booking, key) {
    booking.requestKey = key;
    try {
      if (key) sessionStorage.setItem(REQUEST_KEY, key);
      else sessionStorage.removeItem(REQUEST_KEY);
    } catch { /* In-memory retries still use the original request key. */ }
  }
  const createBookingState = () => {
    const today = venueDateKey();
    return {
      selectedSlots: [], otherDates: new Map(), date: today, weekStart: weekStartFor(today), court: "all", band: "all",
      customer: { name: "", email: "", phone: "" }, errors: {}, confirmation: null, step: 1, message: "",
      requestKey: live ? readRequestKey() : null, submitting: false, recovering: false, retryPending: false, availability: null, serverClock: null,
    };
  };
  const state = {
    route: location.hash.slice(1) || "home",
    booking: createBookingState(),
    leaderboard: { category: "overall", period: "all", search: "" },
    analytics: { range: "month", start: "", end: "" },
    savedBookings: getSavedBookings(),
  };
  const allReservations = () => [...D.reservations, ...state.savedBookings];
  const courtById = (id) => D.courts.find((court) => court.id === id);
  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const icon = (name, size = 20) => {
    const paths = {
      arrow: '<path d="M4 12h15M13 5l7 7-7 7"/>', check: '<path d="m5 12 4 4L19 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      ball: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6c2.1 2.2 3.2 4.4 3.2 6.4s-1.1 4.2-3.2 6.4M18.4 5.6c-2.1 2.2-3.2 4.4-3.2 6.4s1.1 4.2 3.2 6.4M3 12h18"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
      indoor: '<path d="M3 21V7l9-4 9 4v14M3 10h18M9 21v-7h6v7"/>',
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.ball}</svg>`;
  };
  const button = (text, href, cls = "button button-primary", extra = "") => `<a class="${cls}" href="${href}" ${extra}>${text}</a>`;

  function courtCard(court, index = 0, compact = false) {
    return `<article class="court-card ${compact ? "court-card-compact" : ""}" style="--card-index:${index}">
      <a href="#book?court=${court.id}" class="court-image-wrap">
        <img src="${court.image}" alt="${escapeHtml(court.name)} pickleball court" loading="lazy" />
        <span class="court-tag ${court.color}">${court.tag}</span>
        <span class="court-type">${court.type === "Indoor" ? icon("indoor", 14) : icon("sun", 14)} ${court.type}</span>
      </a>
      <div class="court-card-body">
        <div class="court-title-row"><div><h3>${court.name}</h3><p>${court.surface} · ${court.type === "Indoor" ? "Climate controlled" : "Weather dependent"}</p></div><div class="court-rate"><strong>${money(court.price)}</strong><span>/ hour</span></div></div>
        <p class="court-description">${court.description}</p>
        <div class="court-card-bottom"><span class="availability"><i></i> Available today</span><a href="#book?court=${court.id}" class="text-link">Book this court ${icon("arrow", 15)}</a></div>
      </div>
    </article>`;
  }

  function renderHome() {
    return `<section class="hero">
      <div class="hero-photo"></div><div class="hero-scrim"></div>
      <div class="hero-content page-wrap">
        <span class="eyebrow eyebrow-light"><span class="eyebrow-ball">●</span> FOR PICKLEBALL CLUBS & PLAYERS</span>
        <h1>More play.<br /><em>Less admin.</em></h1>
        <p>A simpler way for players to book—and a clearer view of the business for the people who run the courts.</p>
        <div class="hero-actions">${button(`Try player booking ${icon("arrow", 17)}`, "#book")}<a href="#management" class="button button-outline-light">See the owner dashboard</a></div>
        <div class="hero-note"><span class="hero-note-icon">${icon("clock", 17)}</span><span><strong>Courts open daily</strong><br />7:00 am – 10:00 pm</span><span class="note-divider"></span><span><strong>4 premium courts</strong><br />Indoor & outdoor play</span></div>
      </div>
      <div class="hero-side-label">MANILA, PHILIPPINES <span>·</span> EST. FOR YOUR NEXT MATCH</div>
    </section>
    <section class="trust-strip"><div class="page-wrap trust-inner"><span>ONE PLATFORM. TWO GREAT EXPERIENCES.</span><div><span>${icon("check", 16)} Effortless player booking</span><span>${icon("check", 16)} Club owner insights</span><span>${icon("check", 16)} Community rankings</span></div></div></section>
    <section class="section page-wrap section-courts">
      <div class="section-heading"><div><span class="eyebrow">FIND YOUR FAVORITE</span><h2>Courts made for <em>good games.</em></h2><p>From first serves to friendly rivalries, there’s a spot for you here.</p></div><a href="#courts" class="text-link">View all courts ${icon("arrow", 16)}</a></div>
      <div class="court-grid home-court-grid">${D.courts.slice(0, 3).map(courtCard).join("")}</div>
    </section>
    <section class="process-section"><div class="page-wrap process-layout"><div class="process-intro"><span class="eyebrow eyebrow-light">THAT'S THE WHOLE POINT</span><h2>From “game on?”<br />to <em>on the court.</em></h2><p>No calls, no back-and-forth. Your next game is just a few taps away.</p>${button(`Book your next game ${icon("arrow", 16)}`, "#book", "button button-light")}</div><div class="process-steps"><article><span class="step-number">01</span><div class="step-icon">${icon("ball", 25)}</div><h3>Pick your court</h3><p>Choose the setup that feels right, indoors or under the open sky.</p></article><article><span class="step-number">02</span><div class="step-icon">${icon("clock", 25)}</div><h3>Find your time</h3><p>See open time slots and book the one that fits your day.</p></article><article><span class="step-number">03</span><div class="step-icon">${icon("check", 25)}</div><h3>Bring your game</h3><p>Get your confirmation and show up ready to play.</p></article></div></div></section>
    <section class="section page-wrap amenity-section"><div class="amenity-photo"><img src="https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=1200&q=85" alt="Players enjoying a pickleball match" loading="lazy" /><span class="photo-caption">GOOD PEOPLE. GREAT RALLIES.</span></div><div class="amenity-copy"><span class="eyebrow">A LITTLE MORE THAN A COURT</span><h2>Everything you need.<br /><em>Nothing you don't.</em></h2><p>A welcoming neighborhood club where every level belongs, and every match feels like a good one.</p><ul class="amenity-list"><li><span>${icon("check", 15)}</span> Quality paddles available to borrow</li><li><span>${icon("check", 15)}</span> Water station & shaded seating</li><li><span>${icon("check", 15)}</span> Locker rooms and clean facilities</li><li><span>${icon("check", 15)}</span> Beginner-friendly community sessions</li></ul><a href="#about" class="text-link">A little more about us ${icon("arrow", 15)}</a></div></section>
    <section class="rates-section"><div class="page-wrap rates-layout"><div><span class="eyebrow eyebrow-light">STRAIGHTFORWARD PRICING</span><h2>Good games.<br /><em>Good value.</em></h2><p>Book by the hour. Bring your crew. We’ll take care of the rest.</p><a href="#courts" class="text-link text-link-light">See court details ${icon("arrow", 15)}</a></div><div class="rate-cards"><div><span>OUTDOOR COURTS</span><strong><b>₱400</b><small> / hour</small></strong><p>Fresh air and open-sky rallies.</p></div><div class="rate-card-featured"><span>INDOOR COURTS</span><strong><b>₱400</b><small> / hour</small></strong><p>All-weather play, any day.</p></div></div></div></section>
    <section class="section testimonial-section page-wrap"><span class="eyebrow">DON'T JUST TAKE OUR WORD FOR IT</span><h2>Good games have a way of <em>bringing us back.</em></h2><div class="testimonial-grid"><article><div class="stars">★★★★★</div><blockquote>“The easiest court booking I’ve ever used. We’re playing twice a week now.”</blockquote><div class="testimonial-person"><div class="avatar avatar-small" style="--avatar:#dce6fb">JR</div><span><strong>Jordan Rivera</strong><small>Regular since 2024</small></span></div></article><article><div class="stars">★★★★★</div><blockquote>“Great courts, great people, and I can book from my phone in seconds.”</blockquote><div class="testimonial-person"><div class="avatar avatar-small" style="--avatar:#c9e8d7">MC</div><span><strong>Maya Chen</strong><small>League player</small></span></div></article><article><div class="stars">★★★★★</div><blockquote>“Finally found a place where beginners feel just as welcome as everyone else.”</blockquote><div class="testimonial-person"><div class="avatar avatar-small" style="--avatar:#f9dfc8">SP</div><span><strong>Sam Patel</strong><small>Community member</small></span></div></article></div></section>
    <section class="cta-band page-wrap"><div><span class="eyebrow eyebrow-light">BUILT FOR PICKLEBALL FACILITIES</span><h2>Give your club a better way to run.</h2><p>Explore a connected booking, leaderboard, and analytics experience—then picture it with your brand.</p></div><div class="cta-actions">${button(`Explore the owner dashboard ${icon("arrow", 16)}`, "#management", "button button-light")}<a href="#book" class="cta-secondary-link">Try the player experience →</a></div></section>`;
  }

  function renderCourts() {
    return `<section class="page-hero page-wrap"><div><span class="eyebrow">FOUR COURTS. ENDLESS GOOD GAMES.</span><h1>Find your <em>court.</em></h1><p>Premium spaces, friendly faces, and a court that fits your kind of game.</p></div><div class="court-summary"><strong>4</strong><span>unique courts<br />ready to play</span></div></section>
      <section class="page-wrap courts-page-content"><div class="filters-bar"><div class="filter-chips"><button class="chip active" data-court-filter="all">All courts <span>4</span></button><button class="chip" data-court-filter="Indoor">Indoor</button><button class="chip" data-court-filter="Outdoor">Outdoor</button></div><span class="muted-copy">${icon("pin", 15)} Manila, Philippines · Open daily</span></div><div class="court-grid courts-full-grid" id="court-list">${D.courts.map(courtCard).join("")}</div>
      <div class="amenities-strip"><div><span class="amenity-icon">${icon("ball", 19)}</span><span><strong>Equipment</strong><small>Paddles to borrow</small></span></div><div><span class="amenity-icon">${icon("sun", 19)}</span><span><strong>All levels</strong><small>Everyone welcome</small></span></div><div><span class="amenity-icon">${icon("clock", 19)}</span><span><strong>Open every day</strong><small>7am – 10pm</small></span></div><div><span class="amenity-icon">${icon("check", 19)}</span><span><strong>Easy booking</strong><small>Reserve in minutes</small></span></div></div></section>`;
  }

  function renderLiveHome() {
    return `<section class="live-hero"><div class="page-wrap"><p class="eyebrow eyebrow-light">${escapeHtml(facility.name)}</p><h1>Book your next<br><em>pickleball game.</em></h1><p>See available courts, choose your hours, and pay at the venue.</p><div class="hero-actions">${button("Book a court", "#book")}${button("View courts", "#courts", "button button-outline-light")}</div></div></section>
      <section class="page-wrap live-info"><div><h2>Find us</h2><p>${escapeHtml(facility.location)}</p></div><div><h2>Hours</h2><p>Daily · ${clockFromHour(rules.openHour)} – ${clockFromHour(rules.closeHour)} Manila time</p></div></section>`;
  }

  function renderLiveCourts() {
    return `<section class="page-wrap live-list"><h1>Pickleball courts</h1><p>${escapeHtml(facility.location)}</p><div class="court-grid">${D.courts.map((court) => `<article class="court-card live-court"><div class="live-court-icon">${icon(court.type === "Indoor" ? "indoor" : "sun", 25)}</div><h2>${escapeHtml(court.name)}</h2><p>${court.type} · ${escapeHtml(court.surface)}</p><strong>${money(court.price)} / hour</strong>${button("View available times", `#book?court=${court.id}`, "button button-primary")}</article>`).join("")}</div></section>`;
  }

  function renderLiveAbout() {
    return `<section class="page-wrap live-list"><h1>Visit ${escapeHtml(facility.name)}</h1><p>${escapeHtml(facility.location)}</p><p>Open daily, ${clockFromHour(rules.openHour)} – ${clockFromHour(rules.closeHour)} Manila time.</p>${preview ? "" : `<p>For booking changes or questions, email <a href="mailto:${escapeHtml(facility.email)}">${escapeHtml(facility.email)}</a>.</p>`}${button("Book a court", "#book")}</section>`;
  }

  function setupLiveNavigation() {
    document.title = `${facility.name} · ${preview ? "Local preview" : "Pickleball court booking"}`;
    document.querySelector('meta[name="description"]').setAttribute("content", `Reserve a pickleball court at ${facility.name}.`);
    const ribbon = document.querySelector(".demo-ribbon");
    ribbon.hidden = !preview;
    if (preview) ribbon.textContent = "Local preview · Test bookings reset on restart";
    document.querySelector('.main-nav [data-link="leaderboard"]').remove();
    document.querySelector(".header-actions .management-link").remove();
    document.querySelector(".header-actions .button").textContent = "Book a court";
    document.querySelector(".site-header .brand").setAttribute("aria-label", `${facility.name} home`);
    document.querySelector(".site-header .brand > span:last-child").textContent = facility.name;
    document.querySelector(".site-footer").innerHTML = `<div class="footer-main"><div><strong>${escapeHtml(facility.name)}</strong><p>${escapeHtml(facility.location)}</p></div><div class="footer-links"><div>${preview ? "" : `<a href="mailto:${escapeHtml(facility.email)}">Contact the facility</a>`}${config.staffAvailable === false ? "" : '<a href="/staff">Staff bookings</a>'}</div></div></div>`;
  }

  const timeBands = { all: "All hours", morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
  const hourBand = (start) => start < "12:00" ? "morning" : start < "17:00" ? "afternoon" : "evening";
  const slotKey = (courtId, start) => `${courtId}|${start}`;
  const slotKeys = (slots) => new Set(slots.map(({ courtId, start }) => slotKey(courtId, start)));
  const bookingNow = (booking) => rules.venueTime(booking.serverClock ? new Date(Date.now() + booking.serverClock.offset) : new Date());
  function slotStatus(booking, courtId, start, now) {
    if (rules.slotIsPast(booking.date, start, now)) return "past";
    if (live) {
      if (booking.availability?.date !== booking.date || booking.availability.loading || booking.availability.error) return "unknown";
      return booking.availability.booked.has(slotKey(courtId, start)) ? "booked" : "open";
    }
    return allReservations().some((row) => row.courtId === courtId && row.date === booking.date && row.status !== "cancelled" &&
      hourValue(start) < hourValue(row.start) + Number(row.duration) && hourValue(start) + 1 > hourValue(row.start)) ? "booked" : "open";
  }
  const bookingTotal = (booking) => booking.selectedSlots.reduce((sum, slot) => sum + courtById(slot.courtId).price, 0);
  const sortedSlots = (slots) => [...slots].sort((a, b) => a.start.localeCompare(b.start) || a.courtId.localeCompare(b.courtId));
  const durationLabel = (count) => `${count} court-hour${count === 1 ? "" : "s"}`;
  const slotTime = (start) => `${clock(start)} – ${clockFromHour(hourValue(start) + 1)}`;

  function dateStrip(booking, today, maxDate) {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(booking.weekStart, index);
      const disabled = date < today || date > maxDate;
      return `<button type="button" class="booking-date-option ${booking.date === date ? "active" : ""} ${date === today ? "today" : ""}" data-booking-date="${date}" aria-label="${dateFmt(date)}" aria-pressed="${booking.date === date}" ${disabled ? "disabled" : ""}>
        <span>${dateFmt(date, { weekday: "short" })}</span><strong>${dateFmt(date, { day: "numeric" })}</strong>${date === today ? '<small>Today</small>' : ""}</button>`;
    }).join("");
  }

  function selectedSlotRows(slots, removable = false) {
    return sortedSlots(slots).map((slot) => {
      const court = courtById(slot.courtId);
      const name = escapeHtml(slot.courtName ?? court.name);
      return `<li><span class="selected-slot-mark">${icon("check", 14)}</span><span class="selected-slot-copy"><strong>${name}</strong><small>${slotTime(slot.start)}</small></span><strong class="selected-slot-price">${money(slot.price ?? court.price)}</strong>${removable ? `<button type="button" class="remove-slot" data-remove-slot="${slotKey(slot.courtId, slot.start)}" aria-label="Remove ${name} at ${clock(slot.start)}">×</button>` : ""}</li>`;
    }).join("");
  }

  function renderSchedule(b, now) {
    const availability = b.availability;
    if (live && availability?.error) return `<div class="schedule-state" role="status"><p>Live availability couldn’t load.</p><button type="button" class="button button-quiet" data-retry-availability>Try again</button></div>`;
    if (live && (availability?.date !== b.date || availability.loading)) return '<div class="schedule-state" role="status">Checking live availability…</div>';
    const selectedKeys = slotKeys(b.selectedSlots);
    const courts = b.court === "all" ? D.courts : [courtById(b.court)];
    const starts = rules.starts.filter((start) => b.band === "all" || hourBand(start) === b.band);
    const slotLabels = { open: "Available", selected: "Selected", past: "Past", booked: "Booked" };
    return `<div class="court-schedules">${courts.map((court) => `<section class="court-schedule" aria-labelledby="court-${court.id}">
      <div class="court-schedule-heading"><h3 id="court-${court.id}">${escapeHtml(court.name)}</h3><span>${escapeHtml(court.type)} · ${money(court.price)} / hour</span></div>
      <div class="court-hours">${starts.map((start) => {
        const selected = selectedKeys.has(slotKey(court.id, start));
        const status = selected ? "selected" : slotStatus(b, court.id, start, now);
        return `<button type="button" class="schedule-slot ${status}" data-booking-slot="${slotKey(court.id, start)}" aria-label="${escapeHtml(court.name)}, ${slotTime(start)}, ${slotLabels[status]}" aria-pressed="${selected}" ${status === "booked" || status === "past" ? "disabled" : ""}><strong>${clock(start)}</strong><span>${slotLabels[status]}</span></button>`;
      }).join("")}</div></section>`).join("")}</div>`;
  }

  function renderConfirmation(confirmation) {
    const cancelled = confirmation.status === "cancelled";
    const title = cancelled ? "Booking cancelled" : preview ? "Test booking confirmed" : live ? "Booking confirmed" : "Demo booking complete";
    return `<section class="booking-page page-wrap"><div class="booking-success">
      <div class="success-mark">${cancelled ? '×' : icon("check", 34)}</div><h1 tabindex="-1" data-booking-heading>${title}</h1>
      <p class="success-lede">${cancelled ? "The facility released the court-hours listed below." : preview ? "This local test booking will reset when the server restarts." : live ? "Save your booking reference and pay at the venue." : confirmation.persisted ? "This sample booking was saved in this browser." : "This sample booking is available until you reload this page."}</p>
      <div class="confirmation-card"><div class="confirmation-top"><div><span>BOOKING REFERENCE</span><strong>${escapeHtml(confirmation.ref)}</strong></div><span class="confirmed-pill">${cancelled ? "Cancelled" : live ? "Confirmed" : "Demo"}</span></div>
        <div class="confirmation-details"><div><small>BOOKING DATE</small><strong>${dateFmt(confirmation.date)}</strong></div><div><small>TIME ZONE</small><strong>Manila time</strong></div></div>
        <ul class="review-slot-list">${selectedSlotRows(confirmation.reservations)}</ul>
        <div class="confirmation-total"><span>${cancelled ? "Original total" : live ? "Due at the venue" : "Demo total"} · ${durationLabel(confirmation.reservations.length)}</span><strong>${money(confirmation.total)}</strong></div>
      </div>${live && !preview && !cancelled ? `<p class="booking-contact"><strong>${escapeHtml(facility.name)}</strong> · ${escapeHtml(facility.location)}<br>For changes, give your reference to <a href="mailto:${escapeHtml(facility.email)}">${escapeHtml(facility.email)}</a>.</p>` : ""}
      <div class="success-actions"><a class="button button-quiet" href="#home">Back to home</a><button type="button" class="button button-primary" data-book-another>Book another court time</button></div>
    </div></section>`;
  }

  function renderBooking() {
    const b = state.booking;
    if (b.confirmation) return renderConfirmation(b.confirmation);
    const now = bookingNow(b);
    const maxDate = addDays(now.date, rules.advanceDays);
    const slots = b.selectedSlots;
    const total = bookingTotal(b);
    const steps = ["Choose time", "Your details", "Review"];
    const canContinue = slots.length > 0 && (!live || (b.availability?.date === b.date && !b.availability.loading && !b.availability.error));
    const nextLabel = `Continue${slots.length ? ` · ${money(total)}` : ""}`;
    const dateLabel = dateFmt(b.date, { weekday: "long", month: "long", day: "numeric" });
    const availabilityCount = D.courts.reduce((sum, court) => sum + rules.starts.filter((start) => slotStatus(b, court.id, start, now) === "open").length, 0);
    const aside = `<aside class="booking-aside"><section class="booking-summary-card">
      <div class="booking-summary-heading"><h2>Booking summary</h2><span class="summary-count">${slots.length}</span></div><p class="summary-date">${dateLabel}</p>
      ${slots.length ? `<ul class="selected-slot-list">${selectedSlotRows(slots, b.step === 1)}</ul>` : '<div class="summary-empty"><strong>No court-hours selected</strong><p>Choose an available hour to start.</p></div>'}
      <div class="summary-total-row" aria-live="polite" aria-atomic="true"><span>Total</span><strong>${money(total)}</strong></div>
      <small class="summary-rate-note">${durationLabel(slots.length)} · ${live ? "Pay at the venue" : "Demo"}</small>
      ${b.step === 1 ? `<button type="button" class="button button-primary summary-continue" data-next-step="2" ${canContinue ? "" : "disabled"}>Continue</button>` : ""}
    </section></aside>`;
    const message = b.message ? `<p class="booking-alert" role="alert" tabindex="-1" data-booking-message>${escapeHtml(b.message)}</p>` : "";

    return `<section class="booking-page page-wrap"><div class="booking-heading"><div><h1 ${b.recovering ? 'tabindex="-1" data-booking-heading' : ""}>Book a court</h1><p>Reserve one or more court-hours on a single date. All times use Manila time.</p></div>${live ? "" : '<span class="demo-pill">DEMO BOOKING</span>'}</div>
      ${b.recovering ? '<p class="schedule-state" role="status">Looking for your latest booking…</p>' : `<div class="booking-layout"><div class="booking-main">
      <div class="booking-progress" aria-label="Booking progress">${steps.map((label, index) => `<div class="progress-step ${b.step === index + 1 ? "active" : ""} ${b.step > index + 1 ? "done" : ""}" ${b.step === index + 1 ? 'aria-current="step"' : ""}><span>${b.step > index + 1 ? "✓" : index + 1}</span><small>${label}</small></div>`).join("")}</div>
      <div class="booking-step">${message}${b.step === 1 ? `
        <div class="booking-step-heading"><h2 tabindex="-1" data-booking-heading>Choose a date and court time</h2><p>Each slot is one hour. You can select up to ${rules.maxSlots} in one booking.</p></div>
        ${b.retryPending ? '<button type="button" class="button button-quiet" data-recover-booking>Check previous booking</button>' : ""}
        <div class="booking-calendar-heading"><div><button type="button" class="calendar-nav" data-week-shift="-1" aria-label="Previous week" ${b.weekStart <= weekStartFor(now.date) ? "disabled" : ""}>‹</button><button type="button" class="calendar-nav" data-week-shift="1" aria-label="Next week" ${addDays(b.weekStart, 7) > maxDate ? "disabled" : ""}>›</button><button type="button" class="today-button" data-date-today>Today</button></div><label class="date-jump" for="booking-date"><span>Jump to date</span><input id="booking-date" type="date" min="${now.date}" max="${maxDate}" value="${b.date}" /></label></div>
        <div class="booking-date-strip">${dateStrip(b, now.date, maxDate)}</div>
        <div class="schedule-caption"><div><strong>${dateLabel}</strong><span>${clockFromHour(rules.openHour)} – ${clockFromHour(rules.closeHour)}</span></div><div class="availability-legend"><span><i class="legend-open"></i> Available</span><span><i class="legend-selected"></i> Selected</span><span><i class="legend-unavailable"></i> Unavailable</span></div></div>
        ${availabilityCount || (live && (!b.availability || b.availability.loading || b.availability.error)) ? "" : '<p class="no-availability">No court-hours remain for this date. Choose another day.</p>'}
        <div class="schedule-filters"><label>Court<select id="schedule-court"><option value="all">All courts</option>${D.courts.map((court) => `<option value="${court.id}" ${b.court === court.id ? "selected" : ""}>${escapeHtml(court.name)}</option>`).join("")}</select></label><label>Time of day<select id="schedule-band">${Object.entries(timeBands).map(([band, label]) => `<option value="${band}" ${b.band === band ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
        ${renderSchedule(b, now)}
        <div class="booking-grid-footer"><span role="status">${slots.length ? durationLabel(slots.length) + " selected" : "Choose at least one court-hour"}</span><button type="button" class="button button-primary" data-next-step="2" ${canContinue ? "" : "disabled"}>${nextLabel}</button></div>` : b.step === 2 ? `
        <div class="step-title"><div><h2 tabindex="-1" data-booking-heading>Who's playing?</h2><p>${live ? "Enter the details the facility can use to identify and contact you about this booking." : "Use sample details for this demonstration."}</p></div></div>
        <div class="details-selection-note"><strong>${durationLabel(slots.length)} selected</strong><span>${dateLabel} · ${money(total)}</span></div>
        <form id="customer-form" class="customer-form" novalidate>
          ${[["name", "Full name", "text", "name", 100], ["email", "Email address", "email", "email", 254], ["phone", "Phone number", "tel", "tel", 32]].map(([field, label, type, autocomplete, length]) => `<div class="field-group"><label for="customer-${field}">${label}</label><input id="customer-${field}" name="${field}" type="${type}" autocomplete="${autocomplete}" maxlength="${length}" value="${escapeHtml(b.customer[field])}" required ${b.errors[field] ? `aria-invalid="true" aria-describedby="${field}-error"` : ""} />${b.errors[field] ? `<span class="field-error" id="${field}-error">${escapeHtml(b.errors[field])}</span>` : ""}</div>`).join("")}
          <div class="booking-bottom"><button type="button" class="subtle-button" data-back-step="1">Edit court times</button><button class="button button-primary" type="submit">Review booking</button></div>
        </form>` : `
        <div class="step-title"><div><h2 tabindex="-1" data-booking-heading>Review your booking</h2><p>${live ? "Check your details and court-hours. Payment is due at the venue." : "Check your details and court-hours before completing the demo."}</p></div></div>
        <div class="review-customer-card"><div><strong>${escapeHtml(b.customer.name)}</strong><small>${escapeHtml(b.customer.email)} · ${escapeHtml(b.customer.phone)}</small></div><button type="button" class="subtle-button" data-back-step="2" ${b.submitting || b.retryPending ? "disabled" : ""}>Edit details</button></div>
        <div class="review-date-card">${icon("clock", 19)}<span><small>BOOKING DATE · MANILA TIME</small><strong>${dateFmt(b.date)}</strong></span></div>
        <ul class="review-slot-list">${selectedSlotRows(slots)}</ul>
        <div class="review-total-row"><span><strong>${live ? "Due at the venue" : "Demo total"}</strong><small>${durationLabel(slots.length)}</small></span><strong>${money(total)}</strong></div>
        ${live && !preview ? `<p class="booking-contact">For changes or cancellations, email <a href="mailto:${escapeHtml(facility.email)}">${escapeHtml(facility.email)}</a>.</p>` : ""}
        <div class="booking-bottom"><button type="button" class="subtle-button" data-back-step="1" ${b.submitting || b.retryPending ? "disabled" : ""}>Edit court times</button><button type="button" class="button button-primary" data-confirm-booking ${b.submitting ? "disabled" : ""}>${b.submitting ? "Confirming…" : b.retryPending ? "Retry confirmation" : live ? "Confirm booking" : "Confirm demo booking"}</button></div>`}</div>
    </div>${aside}</div>`}</section>`;
  }

  function playerStats(player, category, period) {
    const points = player.points[category][period];
    const scale = period === "weekly" ? 12 : period === "monthly" ? 4 : 1;
    const matches = period === "all" ? player.matches : Math.max(1, Math.round(player.matches / scale));
    const wins = period === "all" ? player.wins : Math.round(matches * player.wins / player.matches);
    const losses = matches - wins;
    return { points, matches, wins, losses, rate: matches ? Math.round(wins / matches * 100) : 0 };
  }
  function renderLeaderboard() {
    const { category, period, search } = state.leaderboard;
    const ranked = D.players.map((p) => ({ ...p, stats: playerStats(p, category, period) })).sort((a, b) => b.stats.points - a.stats.points);
    const filtered = ranked.filter((p) => `${p.name} ${p.handle}`.toLowerCase().includes(search.toLowerCase()));
    const top = ranked.slice(0, 3);
    const rest = search
      ? filtered
      : filtered.filter((p) => p.id !== top[0]?.id && p.id !== top[1]?.id && p.id !== top[2]?.id);
    const periodLabel = { weekly: "this week", monthly: "this month", all: "all time" }[period];
    return `<section class="leaderboard-page"><div class="leaderboard-hero"><div class="page-wrap leaderboard-hero-inner"><div><span class="eyebrow eyebrow-light">FRIENDLY COMPETITION, EVERY DAY</span><h1>Local legends.<br /><em>In the making.</em></h1><p>Celebrate the players, the progress, and every hard-fought rally.</p></div><div class="leaderboard-hero-stats"><div><strong>128</strong><span>active players</span></div><div><strong>1,240</strong><span>matches played</span></div><div><strong>100%</strong><span>good sports</span></div></div></div></div>
      <div class="page-wrap leaderboard-content"><div class="leaderboard-toolbar"><div><span class="eyebrow">THE CLUB LEADERBOARD</span><h2>Top players <span class="live-note"><i></i> DEMO DATA</span></h2></div><div class="leaderboard-filters"><label><span>Category</span><select id="leader-category"><option value="overall" ${category === "overall" ? "selected" : ""}>Overall</option><option value="singles" ${category === "singles" ? "selected" : ""}>Singles</option><option value="doubles" ${category === "doubles" ? "selected" : ""}>Doubles</option></select></label><label><span>Period</span><select id="leader-period"><option value="weekly" ${period === "weekly" ? "selected" : ""}>This week</option><option value="monthly" ${period === "monthly" ? "selected" : ""}>This month</option><option value="all" ${period === "all" ? "selected" : ""}>All time</option></select></label></div></div>
      <div class="podium">${top.map((p, i) => `<button class="podium-card podium-${i + 1}" data-player="${p.id}"><span class="podium-rank">${i === 0 ? "01" : `0${i + 1}`}</span><span class="podium-crown">${i === 0 ? "✦" : ""}</span><div class="avatar podium-avatar" style="--avatar:${p.color}">${p.avatar}</div><strong>${p.name}</strong><span class="podium-handle">${p.handle}</span><span class="podium-points">${p.stats.points.toLocaleString()} <small>PTS</small></span><span class="podium-base">${i === 0 ? "1ST PLACE" : i === 1 ? "2ND PLACE" : "3RD PLACE"}</span></button>`).join("")}</div>
      <div class="table-toolbar"><div><h3>All players <span>${filtered.length}</span></h3><small>Ranked by points ${periodLabel}</small></div><label class="search-box">${icon("ball", 17)}<input id="player-search" type="search" placeholder="Find a player..." value="${escapeHtml(search)}" /><kbd>⌘ K</kbd></label></div>
      <div class="leaderboard-table-wrap"><table class="leaderboard-table"><thead><tr><th>RANK</th><th>PLAYER</th><th>MATCHES</th><th>W / L</th><th>WIN RATE</th><th>POINTS</th><th>CHANGE</th></tr></thead><tbody>${rest.length ? rest.map((p, i) => `<tr data-player="${p.id}" tabindex="0" role="button"><td><span class="rank-num">${String(ranked.findIndex((x) => x.id === p.id) + 1).padStart(2, "0")}</span></td><td><div class="table-player"><div class="avatar avatar-small" style="--avatar:${p.color}">${p.avatar}</div><span><strong>${p.name}</strong><small>${p.handle}</small></span></div></td><td>${p.stats.matches}</td><td>${p.stats.wins} <span class="table-muted">/ ${p.stats.losses}</span></td><td><span class="win-rate">${p.stats.rate}%</span></td><td><strong class="points-number">${p.stats.points.toLocaleString()}</strong></td><td>${p.movement > 0 ? `<span class="movement up">↑ ${p.movement}</span>` : p.movement < 0 ? `<span class="movement down">↓ ${Math.abs(p.movement)}</span>` : `<span class="movement steady">— 0</span>`}</td></tr>`).join("") : `<tr><td colspan="7"><div class="table-empty">No players match “${escapeHtml(search)}”. Try another name.</div></td></tr>`}</tbody></table></div>
      <p class="leaderboard-disclaimer">${icon("check", 15)} Rankings, player profiles, and match records are fictional sample data for this product demo.</p></div></section>`;
  }

  function renderAbout() {
    return `<section class="page-hero about-hero page-wrap"><div><span class="eyebrow">MADE FOR PLAYERS & CLUB OWNERS</span><h1>Better court days<br />start with <em>a better system.</em></h1><p>Explore a customer booking experience and a management dashboard built for a fictional pickleball club. All bookings, rankings, reports, and venue details are sample demo data.</p><a class="button button-primary" href="#book">Try the booking demo ${icon("arrow", 16)}</a></div><div class="about-photo"><img src="https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=85" alt="Pickleball court ready for a game" /><span>GOOD GAMES LIVE HERE</span></div></section>
      <section class="section page-wrap about-details"><div><span class="eyebrow">OUR LITTLE CORNER OF THE COURT</span><h2>Built around the joy<br />of <em>one more game.</em></h2></div><div><p>From your first rally to your hundredth league match, we want finding a place to play to feel just as easy as picking up a paddle.</p><p>This demo shows how a modern club can bring online court reservations, community leaderboards, and facility insights together in one thoughtful experience.</p><a class="text-link" href="#management">Explore the management demo ${icon("arrow", 15)}</a></div></section><section class="page-wrap contact-panel" id="contact"><div><span class="eyebrow eyebrow-light">SAY HELLO</span><h2>See yourself here?</h2><p>This is a sample venue and contact details are placeholders for demonstration only.</p></div><a href="mailto:hello@rallycourt.example" class="button button-light">hello@rallycourt.example ${icon("arrow", 16)}</a></section>`;
  }

  function dateKey(date) {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    return venueDateKey(date);
  }
  function inRange(date, start, end) { return date >= start && date <= end; }
  function getAnalyticsRange() {
    const today = venueDateKey();
    let start = new Date(`${today}T12:00:00Z`), end = new Date(start);
    if (state.analytics.range === "week") { start.setUTCDate(start.getUTCDate() - start.getUTCDay()); end.setUTCDate(start.getUTCDate() + 6); }
    else if (state.analytics.range === "month") { start.setUTCDate(1); end.setUTCMonth(start.getUTCMonth() + 1, 0); }
    else if (state.analytics.range === "year") { start.setUTCMonth(0, 1); end.setUTCMonth(11, 31); }
    else if (state.analytics.range === "custom") {
      return { start: state.analytics.start || today, end: state.analytics.end || today, label: `${state.analytics.start || today} – ${state.analytics.end || today}` };
    }
    return { start: dateKey(start), end: dateKey(end), label: state.analytics.range === "today" ? "Today" : `${dateFmt(dateKey(start), { month: "short", day: "numeric" })} – ${dateFmt(dateKey(end), { month: "short", day: "numeric" })}` };
  }
  function buildAnalytics() {
    const range = getAnalyticsRange();
    let bookings = allReservations().filter((r) => inRange(r.date, range.start, range.end));
    // A larger seeded sample makes reporting periods useful beyond the dates used in the booking demo.
    const sample = [];
    const base = new Date(`${venueDateKey()}T12:00:00Z`);
    for (let i = 0; i < 120; i++) {
      const d = new Date(base); d.setUTCDate(d.getUTCDate() - i);
      const day = d.getUTCDay();
      const count = day === 0 || day === 6 ? 7 : 4;
      for (let j = 0; j < count; j++) {
        const court = D.courts[(i * 3 + j * 2) % D.courts.length];
        const hour = [8, 9, 11, 14, 16, 18, 19][(i + j * 2) % 7];
        const status = (i + j) % 19 === 0 ? "cancelled" : (i + j) % 7 === 0 ? "pending" : "confirmed";
        sample.push({ courtId: court.id, date: dateKey(d), start: `${String(hour).padStart(2, "0")}:00`, duration: 1 + ((i + j) % 3 === 0 ? 1 : 0), status, sample: true });
      }
    }
    bookings = [...sample.filter((r) => inRange(r.date, range.start, range.end)), ...bookings.filter((r) => !D.reservations.some((seed) => seed === r))];
    const confirmed = bookings.filter((r) => r.status === "confirmed");
    const pending = bookings.filter((r) => r.status === "pending");
    const cancelled = bookings.filter((r) => r.status === "cancelled");
    const revenue = confirmed.reduce((sum, r) => sum + (courtById(r.courtId)?.price || 0) * r.duration, 0);
    const courtCounts = D.courts.map((c) => ({ ...c, count: confirmed.filter((r) => r.courtId === c.id).length }));
    const sortedCourts = [...courtCounts].sort((a, b) => b.count - a.count);
    const hours = Array.from({ length: 8 }, (_, i) => ({ hour: i + 8, count: confirmed.filter((r) => Math.floor(hourValue(r.start)) === i + 8).length }));
    const activeDays = Math.max(1, Math.round((new Date(range.end) - new Date(range.start)) / 86400000) + 1);
    const utilization = Math.min(100, Math.round(confirmed.reduce((sum, r) => sum + Number(r.duration), 0) / (D.courts.length * 15 * activeDays) * 100));
    return { range, bookings, confirmed, pending, cancelled, revenue, courtCounts, sortedCourts, hours, utilization };
  }
  const chartBars = (items, key, max, labelKey, extraClass = "") => `<div class="bar-chart ${extraClass}">${items.map((item) => `<div class="bar-item"><div class="bar-track"><span class="bar-fill" style="height:${Math.max(item[key] ? 7 : 0, Math.round(item[key] / (max || 1) * 100))}%"></span></div><span class="bar-label">${item[labelKey]}</span><small>${item[key]}</small></div>`).join("")}</div>`;
  function renderAnalytics() {
    const a = buildAnalytics();
    const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
    const fmtShort = (date) => dateFmt(date, { month: "short", day: "numeric" });
    const rangeStart = new Date(`${a.range.start}T12:00:00`);
    const rangeEnd = new Date(`${a.range.end}T12:00:00`);
    const rangeDays = Math.max(1, Math.round((rangeEnd - rangeStart) / 86400000) + 1);
    const dailyAverage = Math.round(a.revenue / rangeDays);
    const trendBucketCount = Math.min(6, rangeDays);
    const revenueTrend = Array.from({ length: trendBucketCount }, (_, index) => {
      const firstOffset = Math.floor(index * rangeDays / trendBucketCount);
      const lastOffset = Math.floor((index + 1) * rangeDays / trendBucketCount) - 1;
      const start = new Date(rangeStart); start.setDate(start.getDate() + firstOffset);
      const end = new Date(rangeStart); end.setDate(end.getDate() + Math.max(firstOffset, lastOffset));
      const startKey = dateKey(start);
      const endKey = dateKey(end);
      const revenue = a.confirmed.filter((r) => inRange(r.date, startKey, endKey))
        .reduce((sum, r) => sum + (courtById(r.courtId)?.price || 0) * r.duration, 0);
      const label = rangeDays <= 6
        ? dateFmt(startKey, { weekday: "short" })
        : `${fmtShort(startKey)}${startKey === endKey ? "" : `–${dateFmt(endKey, { day: "numeric" })}`}`;
      return { label, revenue };
    });
    const maxRevenueBucket = Math.max(...revenueTrend.map((bucket) => bucket.revenue), 1);
    const revenueTrendMarkup = `<div class="revenue-trend">${revenueTrend.map((bucket) => `<div class="revenue-trend-item"><span class="revenue-trend-value">${money(bucket.revenue)}</span><div class="revenue-trend-track"><i style="height:${bucket.revenue ? Math.max(7, Math.round(bucket.revenue / maxRevenueBucket * 100)) : 0}%"></i></div><small>${bucket.label}</small></div>`).join("")}</div>`;
    const daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = dateKey(d);
      return { day: dateFmt(key, { weekday: "short" }), count: a.confirmed.filter((r) => r.date === key).length };
    });
    const weekly = Array.from({ length: 6 }, (_, i) => {
      const end = new Date(); end.setDate(end.getDate() - (5 - i) * 7); const start = new Date(end); start.setDate(end.getDate() - 6);
      const count = a.confirmed.filter((r) => inRange(r.date, dateKey(start), dateKey(end))).length;
      return { day: `W${i + 1}`, count };
    });
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { day: d.toLocaleDateString("en-US", { month: "short" }), count: a.confirmed.filter((r) => r.date.startsWith(key)).length };
    });
    const statusTotal = a.bookings.length || 1;
    const statusPct = (n) => Math.round(n / statusTotal * 100);
    return `<section class="management-page"><div class="dashboard-sidebar"><a href="#home" class="brand brand-sidebar"><span class="brand-mark">R<span>+</span></span><span>rally<span class="brand-light">court</span></span></a><div class="sidebar-label">DEMO MANAGEMENT</div><a class="sidebar-item active" href="#management"><span>▦</span> Overview</a><a class="sidebar-item" href="#management"><span>▤</span> Reports & analytics</a><div class="sidebar-label sidebar-public-label">PUBLIC SITE</div><a class="sidebar-item" href="#courts"><span>⌂</span> Courts</a><a class="sidebar-item" href="#leaderboard"><span>♧</span> Leaderboard</a><div class="sidebar-bottom"><div class="demo-user"><div class="admin-avatar">RC</div><span><strong>RallyCourt Club</strong><small>DEMO FACILITY</small></span></div><button class="reset-demo-button" data-reset-demo>${icon("ball", 15)} Reset demo data</button></div></div>
      <div class="dashboard-main"><div class="dashboard-topbar"><div class="dashboard-breadcrumb">Management demo <span>/</span> <strong>Overview</strong></div><a href="#home" class="view-site-link">View public site ↗</a></div><div class="dashboard-content"><div class="dashboard-heading"><div><span class="eyebrow">${todayLabel}, YOUR FACILITY AT A GLANCE</span><h1>Good morning, RallyCourt <span>✳</span></h1><p>A clear picture of how your courts are doing. <b>Everything here is simulated demo data.</b></p></div><span class="demo-pill">● DEMO DASHBOARD</span></div>
      <div class="analytics-controls"><div class="range-tabs">${[["today", "Today"], ["week", "This week"], ["month", "This month"], ["year", "This year"], ["custom", "Custom"]].map(([v, l]) => `<button data-range="${v}" class="${state.analytics.range === v ? "active" : ""}">${l}</button>`).join("")}</div><div class="custom-dates ${state.analytics.range === "custom" ? "" : "hidden"}"><input id="range-start" type="date" value="${state.analytics.start}" aria-label="Start date" /><span>to</span><input id="range-end" type="date" value="${state.analytics.end}" aria-label="End date" /><button data-apply-range>Apply</button></div><span class="range-caption">${a.range.label}</span></div>
      <div class="metric-grid"><article class="metric-card"><div class="metric-top"><span>Total bookings</span><span class="metric-icon green">${icon("ball", 18)}</span></div><strong>${a.bookings.length.toLocaleString()}</strong><small><i class="metric-up">↗</i> Sample reservations in range</small><div class="metric-spark spark-green"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article><article class="metric-card"><div class="metric-top"><span>Confirmed</span><span class="metric-icon blue">${icon("check", 18)}</span></div><strong>${a.confirmed.length.toLocaleString()}</strong><small><i class="metric-up">↗</i> ${a.bookings.length ? Math.round(a.confirmed.length / a.bookings.length * 100) : 0}% of all bookings</small><div class="metric-spark spark-blue"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article><article class="metric-card"><div class="metric-top"><span>Pending</span><span class="metric-icon amber">${icon("clock", 18)}</span></div><strong>${a.pending.length.toLocaleString()}</strong><small>Awaiting confirmation <i>·</i> demo</small><div class="metric-spark spark-amber"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article><article class="metric-card"><div class="metric-top"><span>Cancelled</span><span class="metric-icon gray">×</span></div><strong>${a.cancelled.length.toLocaleString()}</strong><small>Cancelled reservations</small><div class="metric-spark spark-gray"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article><article class="metric-card metric-revenue"><div class="metric-top"><span>Est. revenue</span><span class="metric-icon green">${icon("arrow", 18)}</span></div><strong>${money(a.revenue)}</strong><small>Simulated, based on sample bookings</small><div class="metric-spark spark-green"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article><article class="metric-card"><div class="metric-top"><span>Court utilization</span><span class="metric-icon purple">${icon("indoor", 18)}</span></div><strong>${a.utilization}<small class="metric-unit">%</small></strong><small>Confirmed court hours in range</small><div class="metric-spark spark-purple"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article></div>
      <div class="dashboard-charts"><article class="dashboard-panel trend-panel"><div class="panel-heading"><div><h3>Booking trends</h3><p>Daily, weekly, and monthly bookings</p></div><span class="panel-menu">•••</span></div><div class="chart-legend"><span><i class="legend-dot"></i> Confirmed bookings</span><div class="trend-tabs"><button class="active" data-trend="daily">Daily</button><button data-trend="weekly">Weekly</button><button data-trend="monthly">Monthly</button></div></div><div id="trend-chart">${chartBars(daily, "count", Math.max(...daily.map((x) => x.count), 1), "day", "trend-bars")}</div></article>
      <article class="dashboard-panel status-panel"><div class="panel-heading"><div><h3>Booking status</h3><p>All reservations in this range</p></div></div><div class="status-ring" style="--confirmed:${statusPct(a.confirmed.length)};--pending:${statusPct(a.pending.length)}"><div><strong>${a.bookings.length}</strong><small>bookings</small></div></div><div class="status-legend"><span><i class="status-dot-confirmed"></i>Confirmed <b>${a.confirmed.length}</b></span><span><i class="status-dot-pending"></i>Pending <b>${a.pending.length}</b></span><span><i class="status-dot-cancelled"></i>Cancelled <b>${a.cancelled.length}</b></span></div></article></div>
      <div class="dashboard-charts lower-charts"><article class="dashboard-panel court-analytics-panel"><div class="panel-heading"><div><h3>Bookings by court</h3><p>Confirmed reservations · ${a.range.label}</p></div><a href="#courts" class="panel-link">View courts →</a></div><div class="court-bars">${a.courtCounts.map((c) => `<div class="court-bar-row"><span>${c.name.replace("The ", "")}</span><div><i style="width:${Math.max(c.count / (Math.max(...a.courtCounts.map(x => x.count), 1)) * 100, c.count ? 6 : 0)}%"></i></div><strong>${c.count}</strong></div>`).join("")}</div></article>
      <article class="dashboard-panel peak-panel"><div class="panel-heading"><div><h3>Popular start times</h3><p>When players book the most</p></div></div>${chartBars(a.hours, "count", Math.max(...a.hours.map((x) => x.count), 1), "hour", "peak-bars")}<div class="peak-caption">Most popular: <strong>${clock(`${String(a.hours.sort((x, y) => y.count - x.count)[0]?.hour || 8).padStart(2, "0")}:00`)}</strong></div></article></div>
      <div class="dashboard-charts bottom-analytics"><article class="dashboard-panel revenue-panel"><div class="panel-heading"><div><h3>Revenue summary</h3><p>Estimated court rental revenue · demo only</p></div><span class="revenue-total">${money(a.revenue)}</span></div><div class="revenue-kpis"><div><small>DAILY AVERAGE</small><strong>${money(dailyAverage)}</strong></div><div><small>30-DAY RUN RATE</small><strong>${money(dailyAverage * 30)}</strong></div></div><div class="revenue-trend-title">Revenue trend <span>${a.range.label}</span></div>${revenueTrendMarkup}<div class="revenue-breakdown">${a.courtCounts.map((c) => { const value = a.confirmed.filter((r) => r.courtId === c.id).reduce((sum, r) => sum + c.price * r.duration, 0); return `<div><span><i class="revenue-dot" style="--revenue-color:${{c1:"#37a76e",c2:"#4e8daa",c3:"#e5a45b",c4:"#8b78b7"}[c.id]}"></i>${c.name}</span><strong>${money(value)}</strong></div>`; }).join("")}</div><div class="revenue-note">${icon("check", 14)} Simulated revenue from confirmed sample bookings</div></article>
      <article class="dashboard-panel report-panel"><div class="panel-heading"><div><h3>Quick report</h3><p>A snapshot for ${a.range.label}</p></div><span class="report-icon">${icon("arrow", 18)}</span></div><div class="report-preview"><span>BOOKINGS</span><strong>${a.bookings.length}</strong><span>EST. REVENUE</span><strong>${money(a.revenue)}</strong><span>COURT UTILIZATION</span><strong>${a.utilization}%</strong></div><button class="button button-primary export-button" data-export-report>Download sample CSV ${icon("arrow", 15)}</button></article></div>
      <div class="dashboard-footnote">${icon("check", 14)} Demonstration dashboard · All statistics, reservations, and revenue are simulated. No accounting or real facility data is connected.</div>
      </div></div></section>`;
  }

  let lastRenderedHash = null;
  function render() {
    const currentHash = location.hash;
    const hashParts = currentHash.slice(1).split("?");
    const routes = live ? { home: renderLiveHome, courts: renderLiveCourts, book: renderBooking, about: renderLiveAbout } :
      { home: renderHome, courts: renderCourts, book: renderBooking, leaderboard: renderLeaderboard, about: renderAbout, management: renderAnalytics };
    state.route = Object.hasOwn(routes, hashParts[0]) ? hashParts[0] : "home";
    const changedRoute = currentHash !== lastRenderedHash;
    const enteredBooking = changedRoute && state.route === "book";
    const focusRoute = changedRoute && lastRenderedHash !== null;
    if (enteredBooking && state.booking.step === 1) {
      const court = new URLSearchParams(hashParts[1]).get("court");
      if (courtById(court)) state.booking.court = court;
    }
    lastRenderedHash = currentHash;
    document.body.classList.toggle("dashboard-body", state.route === "management");
    app.innerHTML = routes[state.route]();
    document.querySelectorAll(".main-nav a").forEach((a) => a.classList.toggle("active", a.dataset.link === state.route));
    document.querySelector(".site-header").classList.toggle("header-dashboard", state.route === "management");
    document.querySelector(".site-footer").classList.toggle("hidden", state.route === "management");
    document.querySelector(".mobile-menu-button").setAttribute("aria-expanded", "false");
    document.querySelector(".main-nav").classList.remove("nav-open");
    window.scrollTo({ top: 0, behavior: "instant" });
    if (focusRoute) app.focus({ preventScroll: true });
    if (enteredBooking && live) {
      const b = state.booking;
      if (b.requestKey && !b.submitting && (b.confirmation || b.step === 1)) recoverBooking();
      else if (b.step === 1) loadAvailability();
    }
  }

  let activeCourtFilter = "all";
  let activeTrend = "daily";
  function rerender() { render(); }
  function showToast(message) {
    toastRoot.innerHTML = `<div class="toast">${icon("check", 16)} ${message}</div>`;
    setTimeout(() => toastRoot.innerHTML = "", 3000);
  }
  function showPlayer(playerId) {
    const player = D.players.find((p) => p.id === playerId);
    if (!player) return;
    const stats = playerStats(player, state.leaderboard.category, state.leaderboard.period);
    modalRoot.innerHTML = `<div class="modal-backdrop" data-close-modal><section class="player-modal" role="dialog" aria-modal="true" aria-labelledby="player-modal-name"><button class="modal-close" aria-label="Close" data-close-modal>×</button><div class="profile-cover"></div><div class="profile-main"><div class="avatar profile-avatar" style="--avatar:${player.color}">${player.avatar}</div><span class="eyebrow">RALLYCOURT PLAYER</span><h2 id="player-modal-name">${player.name}</h2><p class="profile-handle">${player.handle} <span>·</span> ${player.city}</p><span class="level-pill">${player.level}</span><div class="profile-rank"><span>CURRENT RANK</span><strong>#${String(D.players.map(p => ({p, pts:playerStats(p,state.leaderboard.category,state.leaderboard.period).points})).sort((x,y)=>y.pts-x.pts).findIndex(x=>x.p.id===player.id)+1).padStart(2,"0")}</strong></div><div class="profile-stats"><div><strong>${stats.matches}</strong><small>MATCHES</small></div><div><strong>${stats.wins}</strong><small>WINS</small></div><div><strong>${stats.rate}%</strong><small>WIN RATE</small></div><div><strong>${stats.points.toLocaleString()}</strong><small>POINTS</small></div></div><div class="profile-results"><div><strong>Recent results</strong><span>Last 5 matches · sample data</span></div><div class="result-dots">${player.results.map((r) => `<span class="${r === "W" ? "result-win" : "result-loss"}">${r}</span>`).join("")}</div></div></div></section></div>`;
  }
  function updateBooking(focus) {
    if (state.route !== "book") return;
    app.innerHTML = renderBooking();
    if (focus) (app.querySelector?.(focus) ?? app.querySelector?.("[data-booking-heading]"))?.focus();
  }

  function activeBookingControl() {
    const active = document.activeElement;
    if (active?.id === "booking-date" || active?.id === "schedule-band" || active?.id === "schedule-court") return `#${active.id}`;
    if (active?.dataset.bookingSlot) return `[data-booking-slot="${active.dataset.bookingSlot}"]:not(:disabled)`;
    if (active?.dataset.bookingDate) return `[data-booking-date="${active.dataset.bookingDate}"]:not(:disabled)`;
    if (active?.hasAttribute("data-next-step")) return "[data-next-step]:not(:disabled)";
    if (active?.hasAttribute("data-booking-message")) return "[data-booking-message]";
    if (active?.hasAttribute("data-booking-heading")) return "[data-booking-heading]";
  }

  async function bookingApi(path, body) {
    const response = await fetch(path, {
      ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message), data);
    return data;
  }

  const conflictsFor = (b, now) => b.selectedSlots.filter((slot) => {
    const status = slotStatus(b, slot.courtId, slot.start, now);
    return status === "past" || status === "booked";
  });

  function removeConflicts(b, conflicts) {
    const keys = slotKeys(conflicts);
    b.selectedSlots = b.selectedSlots.filter((slot) => !keys.has(slotKey(slot.courtId, slot.start)));
  }

  function conflictMessage(conflicts) {
    if (conflicts.length === 1) {
      const { courtId, start } = conflicts[0];
      return `${courtById(courtId).name} at ${clock(start)} is no longer available. Review your updated selection.`;
    }
    return `${durationLabel(conflicts.length)} are no longer available. Review your updated selection.`;
  }

  async function loadAvailability({ focus, background = false } = {}) {
    const b = state.booking;
    if (!live || b.confirmation || b.recovering || b.step !== 1) return;
    const date = b.date;
    const previous = b.availability;
    const checking = background && previous?.date === date && !previous.error ? { ...previous } : { date, loading: true };
    b.availability = checking;
    if (checking.loading) updateBooking(focus);
    try {
      const data = await bookingApi(`/api/availability?date=${encodeURIComponent(date)}`);
      if (b !== state.booking || b.availability !== checking || b.date !== date) return;
      b.serverClock = { offset: data.now.epoch - Date.now() };
      b.availability = { date, booked: slotKeys(data.booked) };
      const conflicts = b.step === 1 ? conflictsFor(b, bookingNow(b)) : [];
      if (conflicts.length) {
        removeConflicts(b, conflicts);
        if (!b.message) b.message = conflictMessage(conflicts);
      }
    } catch (error) {
      if (b !== state.booking || b.availability !== checking || b.date !== date) return;
      if (error.code === "DATE_RANGE" && error.now && error.now.date !== date) {
        b.serverClock = { offset: error.now.epoch - Date.now() };
        selectBookingDate(error.now.date, focus);
        return;
      }
      b.availability = { date, error: true };
    }
    if (b.step === 1) updateBooking(activeBookingControl() ?? focus);
  }

  function selectBookingDate(candidate, focus) {
    const b = state.booking;
    const { date: today } = bookingNow(b);
    if (b.step !== 1 || b.recovering) return;
    if (!rules.validDate(candidate) || candidate < today || candidate > addDays(today, rules.advanceDays)) {
      b.message = `Choose a date within the next ${rules.advanceDays} days in Manila time.`;
      updateBooking("[data-booking-message]");
      return;
    }
    if (candidate !== b.date) {
      if (b.selectedSlots.length) b.otherDates.set(b.date, b.selectedSlots);
      else b.otherDates.delete(b.date);
      b.selectedSlots = b.otherDates.get(candidate) ?? [];
      b.otherDates.delete(candidate);
      b.date = candidate;
      b.weekStart = weekStartFor(candidate);
    }
    b.message = "";
    if (live) loadAvailability({ focus });
    else updateBooking(focus);
  }

  function focusStep(step) {
    state.booking.step = step;
    updateBooking("[data-booking-heading]");
  }

  function setConfirmation(b, confirmation) {
    b.confirmation = confirmation;
    b.customer = { name: "", email: "", phone: "" };
    b.otherDates.clear();
    b.selectedSlots = [];
    b.retryPending = false;
  }

  async function recoverBooking() {
    const b = state.booking;
    if (!b.requestKey || b.recovering || b.submitting) return;
    b.recovering = true;
    b.message = "";
    updateBooking();
    let found = false;
    try {
      setConfirmation(b, await bookingApi("/api/booking-status", { requestKey: b.requestKey }));
      found = true;
    } catch (error) {
      if (error.code === "INVALID_REQUEST") setRequestKey(b, null);
      b.retryPending = !["BOOKING_NOT_FOUND", "INVALID_REQUEST"].includes(error.code);
      if (b.retryPending) b.message = "We couldn’t check your previous booking. Use ‘Check previous booking’ to try again.";
    } finally {
      b.recovering = false;
      if (b !== state.booking) return;
      if (found && state.route === "book") updateBooking("[data-booking-heading]");
      else if (state.route === "book" && !b.confirmation) loadAvailability();
    }
  }

  function saveDemoBooking(b) {
    state.savedBookings = getSavedBookings().concat(state.savedBookings.filter((row) => row.sessionOnly));
    const conflicts = conflictsFor(b, bookingNow(b));
    if (conflicts.length) {
      removeConflicts(b, conflicts);
      b.message = conflictMessage(conflicts);
      focusStep(1);
      return;
    }
    const ref = `RC-${Math.random().toString(36).slice(2, 8).padEnd(6, "0").toUpperCase()}`;
    const reservations = b.selectedSlots.map((slot) => ({ ...slot, date: b.date, duration: 1, status: "confirmed", ref }));
    const confirmation = { ref, date: b.date, reservations, total: bookingTotal(b), status: "confirmed", persisted: true };
    state.savedBookings = [...state.savedBookings, ...reservations];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedBookings.map(({ sessionOnly, ...row }) => row)));
      state.savedBookings.forEach((row) => { delete row.sessionOnly; });
    }
    catch {
      confirmation.persisted = false;
      reservations.forEach((row) => { row.sessionOnly = true; });
    }
    setConfirmation(b, confirmation);
    updateBooking("[data-booking-heading]");
  }

  async function saveBooking() {
    const b = state.booking;
    if (b.step !== 3 || b.submitting || b.confirmation || !b.selectedSlots.length) return;
    if (!live) return saveDemoBooking(b);
    if (!b.requestKey) {
      if (!window.crypto?.randomUUID) {
        b.message = "Booking requires a secure connection. Open the HTTPS address or contact the facility.";
        updateBooking("[data-booking-message]");
        return;
      }
      setRequestKey(b, window.crypto.randomUUID());
    }
    b.submitting = true;
    b.message = "";
    updateBooking("[data-booking-heading]");
    let focus = "[data-booking-heading]";
    try {
      const input = { requestKey: b.requestKey, date: b.date, slots: b.selectedSlots, customer: b.customer, expectedTotal: bookingTotal(b) };
      let receipt;
      try { receipt = await bookingApi("/api/bookings", input); }
      catch (error) {
        if (error.code !== "REQUEST_MISMATCH") throw error;
        receipt = await bookingApi("/api/booking-status", { requestKey: b.requestKey });
      }
      setConfirmation(b, receipt);
    } catch (error) {
      focus = "[data-booking-message]";
      const knownFailure = ["SLOT_UNAVAILABLE", "DATE_RANGE", "INVALID_CONTACT", "PRICE_CHANGED", "BOOKING_LIMIT", "INVALID_SLOT", "INVALID_BOOKING", "DUPLICATE_SLOT"].includes(error.code);
      b.retryPending = !knownFailure;
      if (knownFailure) setRequestKey(b, null);
      b.message = knownFailure ? error.message : "We couldn’t verify your booking. Retry confirmation to check the same request.";
      if (error.code === "SLOT_UNAVAILABLE") {
        removeConflicts(b, error.conflicts);
        b.message = conflictMessage(error.conflicts);
        b.step = 1;
      } else if (error.code === "DATE_RANGE") {
        b.serverClock = { offset: error.now.epoch - Date.now() };
        b.date = error.now.date;
        b.weekStart = weekStartFor(b.date);
        b.selectedSlots = [];
        b.step = 1;
      } else if (error.code === "INVALID_CONTACT") {
        b.errors = error.errors;
        b.step = 2;
      } else if (error.code === "PRICE_CHANGED") {
        for (const court of D.courts) if (Object.hasOwn(error.rates, court.id)) court.price = error.rates[court.id];
      }
    } finally {
      b.submitting = false;
      if (b === state.booking && state.route === "book") {
        updateBooking(focus);
        if (b.step === 1 && !b.confirmation) loadAvailability({ background: true });
      }
    }
  }

  function resetDemo() {
    if (!confirm("Reset all demo bookings and restore the original sample availability on this device?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("rallycourt-demo-bookings-v1");
    }
    catch { /* Reset in-memory bookings even if storage is blocked. */ }
    state.savedBookings = [];
    state.booking = createBookingState();
    rerender(); showToast("Demo data has been reset.");
  }

  function handleBookingClick(target) {
    const b = state.booking;
    if (target.closest("[data-book-another]")) {
      if (live) setRequestKey(b, null);
      state.booking = createBookingState();
      if (location.hash === "#book") {
        updateBooking("[data-booking-heading]");
        if (live) loadAvailability({ focus: "[data-booking-heading]" });
      } else location.hash = "#book";
      return;
    }
    if (target.closest("[data-confirm-booking]")) { saveBooking(); return; }
    if (b.confirmation || b.recovering || b.submitting) return;
    const back = target.closest("[data-back-step]");
    if (back && !b.retryPending) {
      b.message = "";
      focusStep(Number(back.dataset.backStep));
      if (b.step === 1 && live) loadAvailability({ background: true });
      return;
    }
    if (b.step !== 1) return;
    const slotButton = target.closest("[data-booking-slot]");
    if (slotButton && !slotButton.disabled) {
      const key = slotButton.dataset.bookingSlot;
      const [courtId, start] = key.split("|");
      if (!courtById(courtId) || !rules.starts.includes(start)) return;
      b.message = "";
      const slot = { courtId, start };
      if (slotKeys(b.selectedSlots).has(key)) removeConflicts(b, [slot]);
      else if (slotStatus(b, courtId, start, bookingNow(b)) !== "open") b.message = "That court-hour is no longer available.";
      else if (b.selectedSlots.length >= rules.maxSlots) b.message = `Select up to ${rules.maxSlots} court-hours per booking.`;
      else b.selectedSlots.push(slot);
      updateBooking(b.message ? "[data-booking-message]" : `[data-booking-slot="${key}"]`);
      return;
    }
    const remove = target.closest("[data-remove-slot]");
    if (remove) {
      const [courtId, start] = remove.dataset.removeSlot.split("|");
      removeConflicts(b, [{ courtId, start }]);
      b.message = "";
      updateBooking("[data-remove-slot]");
      return;
    }
    const dateOption = target.closest("[data-booking-date]");
    if (dateOption && !dateOption.disabled) {
      const date = dateOption.dataset.bookingDate;
      selectBookingDate(date, `[data-booking-date="${date}"]`);
      return;
    }
    const week = target.closest("[data-week-shift]");
    if (week && !week.disabled) {
      const date = addDays(b.weekStart, Number(week.dataset.weekShift) * 7);
      const { date: today } = bookingNow(b);
      selectBookingDate(date < today ? today : date, `[data-week-shift="${week.dataset.weekShift}"]:not(:disabled)`);
      return;
    }
    if (target.closest("[data-date-today]")) { selectBookingDate(bookingNow(b).date, "[data-date-today]"); return; }
    if (target.closest("[data-retry-availability]")) { loadAvailability({ focus: "[data-booking-heading]" }); return; }
    if (target.closest("[data-recover-booking]")) { recoverBooking(); return; }
    const next = target.closest("[data-next-step]");
    if (next && !next.disabled && b.selectedSlots.length) {
      const conflicts = conflictsFor(b, bookingNow(b));
      if (conflicts.length) {
        removeConflicts(b, conflicts);
        b.message = conflictMessage(conflicts);
        updateBooking("[data-booking-message]");
        return;
      }
      b.message = "";
      b.retryPending = false;
      focusStep(2);
    }
  }

  document.addEventListener("click", (event) => {
    const menu = event.target.closest(".mobile-menu-button");
    if (menu) {
      const open = menu.getAttribute("aria-expanded") !== "true";
      menu.setAttribute("aria-expanded", String(open));
      document.querySelector(".main-nav").classList.toggle("nav-open", open);
      return;
    }
    const courtFilter = event.target.closest("[data-court-filter]");
    if (courtFilter) {
      activeCourtFilter = courtFilter.dataset.courtFilter;
      document.querySelectorAll("[data-court-filter]").forEach((x) => x.classList.toggle("active", x === courtFilter));
      document.querySelector("#court-list").innerHTML = D.courts.filter((c) => activeCourtFilter === "all" || c.type === activeCourtFilter).map(courtCard).join("");
      return;
    }
    if (state.route === "book") handleBookingClick(event.target);
    const playerRow = event.target.closest("[data-player]");
    if (playerRow) { showPlayer(playerRow.dataset.player); return; }
    if (event.target.closest("[data-close-modal]") && (event.target === event.target.closest(".modal-backdrop") || event.target.closest(".modal-close"))) { modalRoot.innerHTML = ""; return; }
    const range = event.target.closest("[data-range]");
    if (range) {
      state.analytics.range = range.dataset.range; rerender(); return;
    }
    if (event.target.closest("[data-apply-range]")) {
      state.analytics.start = document.querySelector("#range-start").value; state.analytics.end = document.querySelector("#range-end").value;
      if (!state.analytics.start || !state.analytics.end || state.analytics.start > state.analytics.end) { showToast("Choose a valid date range."); return; }
      rerender(); return;
    }
    const trend = event.target.closest("[data-trend]");
    if (trend) {
      activeTrend = trend.dataset.trend;
      document.querySelectorAll("[data-trend]").forEach((x) => x.classList.toggle("active", x === trend));
      const a = buildAnalytics(); let items;
      if (activeTrend === "daily") items = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=dateKey(d);return {day:dateFmt(key,{weekday:"short"}),count:a.confirmed.filter(r=>r.date===key).length};});
      else if (activeTrend === "weekly") items = Array.from({length:6},(_,i)=>{const e=new Date();e.setDate(e.getDate()-(5-i)*7);const s=new Date(e);s.setDate(e.getDate()-6);return {day:`W${i+1}`,count:a.confirmed.filter(r=>inRange(r.date,dateKey(s),dateKey(e))).length};});
      else items = Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;return {day:d.toLocaleDateString("en-US",{month:"short"}),count:a.confirmed.filter(r=>r.date.startsWith(key)).length};});
      document.querySelector("#trend-chart").innerHTML = chartBars(items, "count", Math.max(...items.map(x=>x.count),1), "day", "trend-bars"); return;
    }
    if (event.target.closest("[data-export-report]")) {
      const a = buildAnalytics(); const rows = [["RallyCourt demo report"],["Date range",a.range.label],[],["Metric","Value"],["Total bookings",a.bookings.length],["Confirmed bookings",a.confirmed.length],["Pending bookings",a.pending.length],["Cancelled bookings",a.cancelled.length],["Estimated revenue (PHP)",a.revenue],["Court utilization (%)",a.utilization],[],["Court","Confirmed bookings","Estimated revenue (PHP)"],...a.courtCounts.map(c=>[c.name,a.confirmed.filter(r=>r.courtId===c.id).length,a.confirmed.filter(r=>r.courtId===c.id).reduce((sum,r)=>sum+c.price*r.duration,0)])];
      const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n"); const blob = new Blob([csv],{type:"text/csv"}); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download="rallycourt-demo-report.csv"; link.click(); URL.revokeObjectURL(url); showToast("Sample CSV report downloaded."); return;
    }
    if (event.target.closest("[data-reset-demo]")) resetDemo();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "booking-date") selectBookingDate(event.target.value, "#booking-date");
    else if (event.target.id === "schedule-court") {
      state.booking.court = event.target.value;
      updateBooking("#schedule-court");
    } else if (event.target.id === "schedule-band") {
      state.booking.band = event.target.value;
      updateBooking("#schedule-band");
    } else if (event.target.id === "leader-category") { state.leaderboard.category = event.target.value; rerender(); }
    else if (event.target.id === "leader-period") { state.leaderboard.period = event.target.value; rerender(); }
  });
  document.addEventListener("input", (event) => {
    if (event.target.form?.id === "customer-form" && Object.hasOwn(state.booking.customer, event.target.name)) {
      state.booking.customer[event.target.name] = event.target.value;
    } else if (event.target.id === "player-search") {
      const start = event.target.selectionStart;
      state.leaderboard.search = event.target.value;
      const scrollY = window.scrollY;
      const inputFocused = true;
      app.innerHTML = renderLeaderboard();
      const input = document.querySelector("#player-search");
      input.focus(); input.setSelectionRange(start, start);
      if (inputFocused) window.scrollTo(0, scrollY);
    }
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id !== "customer-form") return;
    event.preventDefault();
    const b = state.booking;
    if (b.step !== 2 || !b.selectedSlots.length) return;
    const data = new FormData(event.target);
    const { customer, errors } = rules.checkCustomer({ name: data.get("name"), email: data.get("email"), phone: data.get("phone") });
    b.customer = customer;
    b.errors = errors;
    const invalidField = Object.keys(errors)[0];
    if (invalidField) { updateBooking(`#customer-${invalidField}`); return; }
    b.message = "";
    focusStep(3);
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") modalRoot.innerHTML = "";
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && state.route === "leaderboard") {
      event.preventDefault(); document.querySelector("#player-search")?.focus();
    }
    if (event.key === "Enter" && event.target.matches("tr[data-player]")) showPlayer(event.target.dataset.player);
  });
  if (live) {
    setupLiveNavigation();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && state.route === "book") {
        if (state.booking.confirmation) recoverBooking();
        else loadAvailability({ background: true });
      }
    });
  }
  render();
})();
