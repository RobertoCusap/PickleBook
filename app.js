(() => {
  "use strict";
  const D = window.RALLY_DATA;
  const app = document.querySelector("#app");
  const modalRoot = document.querySelector("#modal-root");
  const toastRoot = document.querySelector("#toast-root");
  const STORAGE_KEY = "rallycourt-demo-bookings-v1";
  const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const dateFmt = (date, options = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", options);
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
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((row) =>
        row && D.courts.some((court) => court.id === row.courtId) &&
        /^\d{4}-\d{2}-\d{2}$/.test(row.date) && /^\d{2}:\d{2}$/.test(row.start) &&
        Number(row.duration) > 0 && row.status === "confirmed"
      ) : [];
    } catch { return []; }
  };
  const state = {
    route: location.hash.slice(1) || "home",
    booking: { courtId: "", date: "", start: "", duration: 1, customer: { name: "", email: "", phone: "" }, confirmation: null, step: 1 },
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
      <div class="hero-side-label">AUSTIN, TEXAS <span>·</span> EST. FOR YOUR NEXT MATCH</div>
    </section>
    <section class="trust-strip"><div class="page-wrap trust-inner"><span>ONE PLATFORM. TWO GREAT EXPERIENCES.</span><div><span>${icon("check", 16)} Effortless player booking</span><span>${icon("check", 16)} Club owner insights</span><span>${icon("check", 16)} Community rankings</span></div></div></section>
    <section class="section page-wrap section-courts">
      <div class="section-heading"><div><span class="eyebrow">FIND YOUR FAVORITE</span><h2>Courts made for <em>good games.</em></h2><p>From first serves to friendly rivalries, there’s a spot for you here.</p></div><a href="#courts" class="text-link">View all courts ${icon("arrow", 16)}</a></div>
      <div class="court-grid home-court-grid">${D.courts.slice(0, 3).map(courtCard).join("")}</div>
    </section>
    <section class="process-section"><div class="page-wrap process-layout"><div class="process-intro"><span class="eyebrow eyebrow-light">THAT'S THE WHOLE POINT</span><h2>From “game on?”<br />to <em>on the court.</em></h2><p>No calls, no back-and-forth. Your next game is just a few taps away.</p>${button(`Book your next game ${icon("arrow", 16)}`, "#book", "button button-light")}</div><div class="process-steps"><article><span class="step-number">01</span><div class="step-icon">${icon("ball", 25)}</div><h3>Pick your court</h3><p>Choose the setup that feels right, indoors or under the open sky.</p></article><article><span class="step-number">02</span><div class="step-icon">${icon("clock", 25)}</div><h3>Find your time</h3><p>See open time slots and book the one that fits your day.</p></article><article><span class="step-number">03</span><div class="step-icon">${icon("check", 25)}</div><h3>Bring your game</h3><p>Get your confirmation and show up ready to play.</p></article></div></div></section>
    <section class="section page-wrap amenity-section"><div class="amenity-photo"><img src="https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=1200&q=85" alt="Players enjoying a pickleball match" loading="lazy" /><span class="photo-caption">GOOD PEOPLE. GREAT RALLIES.</span></div><div class="amenity-copy"><span class="eyebrow">A LITTLE MORE THAN A COURT</span><h2>Everything you need.<br /><em>Nothing you don't.</em></h2><p>A welcoming neighborhood club where every level belongs, and every match feels like a good one.</p><ul class="amenity-list"><li><span>${icon("check", 15)}</span> Quality paddles available to borrow</li><li><span>${icon("check", 15)}</span> Water station & shaded seating</li><li><span>${icon("check", 15)}</span> Locker rooms and clean facilities</li><li><span>${icon("check", 15)}</span> Beginner-friendly community sessions</li></ul><a href="#about" class="text-link">A little more about us ${icon("arrow", 15)}</a></div></section>
    <section class="rates-section"><div class="page-wrap rates-layout"><div><span class="eyebrow eyebrow-light">STRAIGHTFORWARD PRICING</span><h2>Good games.<br /><em>Good value.</em></h2><p>Book by the hour. Bring your crew. We’ll take care of the rest.</p><a href="#courts" class="text-link text-link-light">See court details ${icon("arrow", 15)}</a></div><div class="rate-cards"><div><span>OUTDOOR COURTS</span><strong>From <b>$22</b><small> / hour</small></strong><p>Fresh air and open-sky rallies.</p></div><div class="rate-card-featured"><span>INDOOR COURTS</span><strong>From <b>$28</b><small> / hour</small></strong><p>All-weather play, any day.</p></div></div></div></section>
    <section class="section testimonial-section page-wrap"><span class="eyebrow">DON'T JUST TAKE OUR WORD FOR IT</span><h2>Good games have a way of <em>bringing us back.</em></h2><div class="testimonial-grid"><article><div class="stars">★★★★★</div><blockquote>“The easiest court booking I’ve ever used. We’re playing twice a week now.”</blockquote><div class="testimonial-person"><div class="avatar avatar-small" style="--avatar:#dce6fb">JR</div><span><strong>Jordan Rivera</strong><small>Regular since 2024</small></span></div></article><article><div class="stars">★★★★★</div><blockquote>“Great courts, great people, and I can book from my phone in seconds.”</blockquote><div class="testimonial-person"><div class="avatar avatar-small" style="--avatar:#c9e8d7">MC</div><span><strong>Maya Chen</strong><small>League player</small></span></div></article><article><div class="stars">★★★★★</div><blockquote>“Finally found a place where beginners feel just as welcome as everyone else.”</blockquote><div class="testimonial-person"><div class="avatar avatar-small" style="--avatar:#f9dfc8">SP</div><span><strong>Sam Patel</strong><small>Community member</small></span></div></article></div></section>
    <section class="cta-band page-wrap"><div><span class="eyebrow eyebrow-light">BUILT FOR PICKLEBALL FACILITIES</span><h2>Give your club a better way to run.</h2><p>Explore a connected booking, leaderboard, and analytics experience—then picture it with your brand.</p></div><div class="cta-actions">${button(`Explore the owner dashboard ${icon("arrow", 16)}`, "#management", "button button-light")}<a href="#book" class="cta-secondary-link">Try the player experience →</a></div></section>`;
  }

  function renderCourts() {
    return `<section class="page-hero page-wrap"><div><span class="eyebrow">FOUR COURTS. ENDLESS GOOD GAMES.</span><h1>Find your <em>court.</em></h1><p>Premium spaces, friendly faces, and a court that fits your kind of game.</p></div><div class="court-summary"><strong>4</strong><span>unique courts<br />ready to play</span></div></section>
      <section class="page-wrap courts-page-content"><div class="filters-bar"><div class="filter-chips"><button class="chip active" data-court-filter="all">All courts <span>4</span></button><button class="chip" data-court-filter="Indoor">Indoor</button><button class="chip" data-court-filter="Outdoor">Outdoor</button></div><span class="muted-copy">${icon("pin", 15)} Austin, Texas · Open daily</span></div><div class="court-grid courts-full-grid" id="court-list">${D.courts.map(courtCard).join("")}</div>
      <div class="amenities-strip"><div><span class="amenity-icon">${icon("ball", 19)}</span><span><strong>Equipment</strong><small>Paddles to borrow</small></span></div><div><span class="amenity-icon">${icon("sun", 19)}</span><span><strong>All levels</strong><small>Everyone welcome</small></span></div><div><span class="amenity-icon">${icon("clock", 19)}</span><span><strong>Open every day</strong><small>7am – 10pm</small></span></div><div><span class="amenity-icon">${icon("check", 19)}</span><span><strong>Easy booking</strong><small>Reserve in minutes</small></span></div></div></section>`;
  }

  function slotIsAvailable(courtId, date, start, duration) {
    const startH = hourValue(start);
    return !allReservations().some((r) => {
      if (r.courtId !== courtId || r.date !== date || r.status === "cancelled") return false;
      const bookedStart = hourValue(r.start);
      const bookedEnd = bookedStart + Number(r.duration);
      return startH < bookedEnd && startH + Number(duration) > bookedStart;
    });
  }
  const timeSlots = () => Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
  function renderBooking() {
    const b = state.booking;
    if (b.confirmation) return `<section class="booking-page page-wrap"><div class="booking-success"><div class="success-mark">${icon("check", 34)}</div><span class="eyebrow">DEMO BOOKING COMPLETE</span><h1>You're on the <em>court.</em></h1><p class="success-lede">Your sample reservation has been saved on this device. No real booking was submitted.</p><div class="confirmation-card"><div class="confirmation-top"><div><span>BOOKING REFERENCE</span><strong>${b.confirmation.ref}</strong></div><span class="confirmed-pill"><i></i> Demo confirmed</span></div><div class="confirmation-details"><div><small>COURT</small><strong>${courtById(b.courtId).name}</strong></div><div><small>DATE</small><strong>${dateFmt(b.date, { month: "long", day: "numeric", year: "numeric" })}</strong></div><div><small>TIME</small><strong>${clock(b.start)} – ${clockFromHour(hourValue(b.start) + Number(b.duration))}</strong></div><div><small>PLAYER</small><strong>${escapeHtml(b.customer.name)}</strong></div></div><div class="confirmation-total"><span>Estimated total · ${b.duration} ${b.duration === 1 ? "hour" : "hours"}</span><strong>${money(courtById(b.courtId).price * b.duration)}</strong></div></div><div class="success-actions"><a class="button button-primary" href="#home">Back to home ${icon("arrow", 16)}</a><button class="button button-quiet" data-book-another>Make another demo booking</button></div></div></section>`;
    const steps = ["Court", "Date & time", "Your details", "Confirm"];
    const currentCourt = courtById(b.courtId);
    const availableSlots = b.date && b.courtId ? timeSlots().filter((s) => hourValue(s) + Number(b.duration) <= 22 && slotIsAvailable(b.courtId, b.date, s, b.duration)) : [];
    const minimumDate = new Date(); minimumDate.setHours(0, 0, 0, 0);
    const minimumString = new Date(minimumDate.getTime() - minimumDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return `<section class="booking-page page-wrap"><div class="booking-heading"><div><span class="eyebrow">A FEW TAPS AND YOU'RE THERE</span><h1>Book your <em>court.</em></h1><p>This interactive demo saves sample bookings only to your browser.</p></div><span class="demo-pill">● DEMO BOOKING</span></div>
      <div class="booking-layout"><div class="booking-main"><div class="booking-progress">${steps.map((s, i) => `<div class="progress-step ${b.step === i + 1 ? "active" : ""} ${b.step > i + 1 ? "done" : ""}"><span>${b.step > i + 1 ? "✓" : `0${i + 1}`}</span><small>${s}</small></div>`).join("")}</div>
      ${b.step === 1 ? `<div class="booking-step"><div class="step-title"><div><span class="step-kicker">STEP 01</span><h2>Choose your court</h2><p>Pick the space that suits your game.</p></div></div><div class="booking-court-list">${D.courts.map((c) => `<button class="booking-court-option ${b.courtId === c.id ? "selected" : ""}" data-select-court="${c.id}"><img src="${c.image}" alt="" /><span class="booking-court-info"><strong>${c.name}</strong><small>${c.type} · ${c.surface}</small></span><span class="booking-court-rate">${money(c.price)}<small>/hr</small></span><span class="radio-indicator"></span></button>`).join("")}</div><div class="booking-bottom"><span class="muted-copy">${icon("check", 15)} No payment needed for this demo</span><button class="button button-primary" data-next-step="2" ${!b.courtId ? "disabled" : ""}>Choose a date ${icon("arrow", 16)}</button></div></div>` :
      b.step === 2 ? `<div class="booking-step"><div class="step-title"><div><span class="step-kicker">STEP 02</span><h2>Find a time to play</h2><p>All times shown in Central Time · 7:00 am – 10:00 pm</p></div><button class="subtle-button" data-back-step="1">← Change court</button></div><div class="selection-summary"><span class="mini-court-icon">${icon("ball", 18)}</span><span><strong>${currentCourt.name}</strong><small>${currentCourt.type} · ${money(currentCourt.price)}/hour</small></span></div><div class="field-group"><label for="booking-date">Choose a date</label><input id="booking-date" type="date" min="${minimumString}" value="${b.date}" /></div><div class="field-group"><label>How long would you like to play?</label><div class="duration-options">${[1, 1.5, 2].map((d) => `<button class="duration-chip ${Number(b.duration) === d ? "active" : ""}" data-duration="${d}">${d} ${d === 1 ? "hour" : "hours"}</button>`).join("")}</div></div><div class="field-group"><label>Available start times ${b.date ? `<span class="label-sub">${dateFmt(b.date, { weekday: "short", month: "short", day: "numeric" })}</span>` : ""}</label><div class="time-slots">${!b.date ? `<p class="inline-empty">Select a date to see available times.</p>` : availableSlots.length ? availableSlots.map((s) => `<button class="time-chip ${b.start === s ? "active" : ""}" data-start="${s}">${clock(s)}</button>`).join("") : `<p class="inline-empty">No times are available for this date and duration. Try another date or duration.</p>`}</div></div><div class="booking-bottom"><button class="subtle-button" data-back-step="1">← Back</button><button class="button button-primary" data-next-step="3" ${!b.date || !b.start ? "disabled" : ""}>Add your details ${icon("arrow", 16)}</button></div></div>` :
      b.step === 3 ? `<div class="booking-step"><div class="step-title"><div><span class="step-kicker">STEP 03</span><h2>Who's playing?</h2><p>Just the basics. Your details stay right here in this demo.</p></div><button class="subtle-button" data-back-step="2">← Edit time</button></div><div class="selection-summary"><span class="mini-court-icon">${icon("ball", 18)}</span><span><strong>${currentCourt.name}</strong><small>${dateFmt(b.date, { weekday: "short", month: "short", day: "numeric" })} · ${clock(b.start)} · ${b.duration} ${b.duration === 1 ? "hour" : "hours"}</small></span></div><form id="customer-form" class="customer-form" novalidate><div class="field-group"><label for="customer-name">Full name</label><input id="customer-name" name="name" autocomplete="name" placeholder="e.g. Jamie Parker" value="${escapeHtml(b.customer.name)}" required /></div><div class="field-group"><label for="customer-email">Email address</label><input id="customer-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" value="${escapeHtml(b.customer.email)}" required /></div><div class="field-group"><label for="customer-phone">Phone number</label><input id="customer-phone" name="phone" type="tel" autocomplete="tel" placeholder="(555) 000-0000" value="${escapeHtml(b.customer.phone)}" required /></div><p class="privacy-note">${icon("check", 15)} Demo only. Information isn't sent or stored.</p><div class="booking-bottom"><button type="button" class="subtle-button" data-back-step="2">← Back</button><button class="button button-primary" type="submit">Review booking ${icon("arrow", 16)}</button></div></form></div>` :
      `<div class="booking-step"><div class="step-title"><div><span class="step-kicker">STEP 04</span><h2>Review your game</h2><p>Everything look right? Confirm to finish this demo.</p></div><button class="subtle-button" data-back-step="3">← Edit details</button></div><div class="review-card"><div class="review-court-photo"><img src="${currentCourt.image}" alt="${currentCourt.name}" /><span>${currentCourt.type} court</span></div><div class="review-summary"><h3>${currentCourt.name}</h3><p>${currentCourt.surface}</p><div class="review-grid"><div><small>DATE</small><strong>${dateFmt(b.date, { weekday: "long", month: "long", day: "numeric" })}</strong></div><div><small>TIME</small><strong>${clock(b.start)} – ${clockFromHour(hourValue(b.start) + Number(b.duration))}</strong></div><div><small>DURATION</small><strong>${b.duration} ${b.duration === 1 ? "hour" : "hours"}</strong></div><div><small>PLAYER</small><strong>${escapeHtml(b.customer.name)}</strong></div><div><small>CONTACT</small><strong>${escapeHtml(b.customer.email)}</strong></div></div><div class="price-line"><span>${money(currentCourt.price)} × ${b.duration} ${b.duration === 1 ? "hour" : "hours"}</span><strong>${money(currentCourt.price * b.duration)}</strong></div><div class="price-line price-total"><span>Estimated total</span><strong>${money(currentCourt.price * b.duration)}</strong></div></div></div><div class="demo-warning">${icon("check", 16)} This is a demonstration. No real reservation, payment, or message will be made.</div><div class="booking-bottom"><button class="subtle-button" data-back-step="3">← Back</button><button class="button button-primary" data-confirm-booking>Confirm demo booking ${icon("arrow", 16)}</button></div></div>`}
      </div><aside class="booking-aside"><div class="aside-card"><span class="eyebrow">THE RALLYCOURT PROMISE</span><h3>Less admin.<br /><em>More rallies.</em></h3><ul><li>${icon("check", 15)} Simple, flexible booking</li><li>${icon("check", 15)} Courts for every kind of game</li><li>${icon("check", 15)} A welcoming local community</li></ul><div class="aside-open"><span class="open-dot"></span><span><strong>Open today</strong><small>7:00 am – 10:00 pm</small></span></div></div><div class="help-card"><span>${icon("ball", 20)}</span><p><strong>Questions?</strong><br />We’re happy to help.</p><a href="mailto:hello@rallycourt.example">Get in touch →</a></div></aside></div></section>`;
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

  function dateKey(date) { return new Date(date).toISOString().slice(0, 10); }
  function inRange(date, start, end) { return date >= start && date <= end; }
  function getAnalyticsRange() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const today = dateKey(now);
    let start = new Date(now), end = new Date(now);
    if (state.analytics.range === "week") { start.setDate(now.getDate() - now.getDay()); end.setDate(start.getDate() + 6); }
    else if (state.analytics.range === "month") { start.setDate(1); end.setMonth(now.getMonth() + 1, 0); }
    else if (state.analytics.range === "year") { start.setMonth(0, 1); end.setMonth(11, 31); }
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
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 120; i++) {
      const d = new Date(base); d.setDate(d.getDate() - i);
      const day = d.getDay();
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

  let lastRenderedHash = "";
  function render() {
    const currentHash = location.hash;
    const hashParts = currentHash.slice(1).split("?");
    state.route = hashParts[0] || "home";
    if (currentHash !== lastRenderedHash && state.route === "book" && hashParts[1]) {
      const court = new URLSearchParams(hashParts[1]).get("court");
      if (D.courts.some((c) => c.id === court)) {
        state.booking.courtId = court;
        state.booking.date = "";
        state.booking.start = "";
        state.booking.duration = 1;
        state.booking.confirmation = null;
        state.booking.step = 1;
      }
    }
    lastRenderedHash = currentHash;
    document.body.classList.toggle("dashboard-body", state.route === "management");
    const routes = { home: renderHome, courts: renderCourts, book: renderBooking, leaderboard: renderLeaderboard, about: renderAbout, management: renderAnalytics };
    app.innerHTML = (routes[state.route] || renderHome)();
    document.querySelectorAll(".main-nav a").forEach((a) => a.classList.toggle("active", a.dataset.link === state.route));
    document.querySelector(".site-header").classList.toggle("header-dashboard", state.route === "management");
    document.querySelector(".site-footer").classList.toggle("hidden", state.route === "management");
    document.querySelector(".mobile-menu-button").setAttribute("aria-expanded", "false");
    document.querySelector(".main-nav").classList.remove("nav-open");
    window.scrollTo({ top: 0, behavior: "instant" });
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
  function saveBooking() {
    const b = state.booking;
    if (!slotIsAvailable(b.courtId, b.date, b.start, b.duration)) {
      b.step = 2; b.start = ""; rerender(); showToast("That time was just taken. Please choose another."); return;
    }
    const reservation = { courtId: b.courtId, date: b.date, start: b.start, duration: Number(b.duration), status: "confirmed", ref: `RC-${Math.random().toString(36).slice(2, 8).toUpperCase()}` };
    state.savedBookings = [...state.savedBookings, reservation];
    let persisted = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedBookings)); }
    catch { persisted = false; }
    b.confirmation = reservation;
    rerender();
    showToast(persisted ? "Demo booking saved on this device." : "Demo booking saved for this session only.");
  }
  function resetDemo() {
    if (!confirm("Reset all demo bookings and restore the original sample availability on this device?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state.savedBookings = [];
    state.booking = { courtId: "", date: "", start: "", duration: 1, customer: { name: "", email: "", phone: "" }, confirmation: null, step: 1 };
    rerender(); showToast("Demo data has been reset.");
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
    const court = event.target.closest("[data-select-court]");
    if (court) { state.booking.courtId = court.dataset.selectCourt; rerender(); return; }
    const next = event.target.closest("[data-next-step]");
    if (next && !next.disabled) {
      if (Number(next.dataset.nextStep) === 3 && (!state.booking.date || !state.booking.start)) return;
      state.booking.step = Number(next.dataset.nextStep); rerender(); return;
    }
    const back = event.target.closest("[data-back-step]");
    if (back) { state.booking.step = Number(back.dataset.backStep); rerender(); return; }
    const duration = event.target.closest("[data-duration]");
    if (duration) {
      state.booking.duration = Number(duration.dataset.duration);
      if (state.booking.start && !slotIsAvailable(state.booking.courtId, state.booking.date, state.booking.start, state.booking.duration)) state.booking.start = "";
      rerender(); return;
    }
    const start = event.target.closest("[data-start]");
    if (start) { state.booking.start = start.dataset.start; rerender(); return; }
    const confirmButton = event.target.closest("[data-confirm-booking]");
    if (confirmButton) { saveBooking(); return; }
    if (event.target.closest("[data-book-another]")) { state.booking = { courtId: "", date: "", start: "", duration: 1, customer: { name: "", email: "", phone: "" }, confirmation: null, step: 1 }; rerender(); location.hash = "#book"; return; }
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
      const a = buildAnalytics(); const rows = [["RallyCourt demo report"],["Date range",a.range.label],[],["Metric","Value"],["Total bookings",a.bookings.length],["Confirmed bookings",a.confirmed.length],["Pending bookings",a.pending.length],["Cancelled bookings",a.cancelled.length],["Estimated revenue (USD)",a.revenue],["Court utilization (%)",a.utilization],[],["Court","Confirmed bookings","Estimated revenue (USD)"],...a.courtCounts.map(c=>[c.name,a.confirmed.filter(r=>r.courtId===c.id).length,a.confirmed.filter(r=>r.courtId===c.id).reduce((sum,r)=>sum+c.price*r.duration,0)])];
      const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n"); const blob = new Blob([csv],{type:"text/csv"}); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download="rallycourt-demo-report.csv"; link.click(); URL.revokeObjectURL(url); showToast("Sample CSV report downloaded."); return;
    }
    if (event.target.closest("[data-reset-demo]")) resetDemo();
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "booking-date") {
      const candidate = event.target.value;
      const localToday = new Date(); localToday.setHours(0, 0, 0, 0);
      const minDate = new Date(localToday.getTime() - localToday.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      if (candidate && candidate < minDate) { showToast("Please choose today or a future date."); return; }
      state.booking.date = candidate; state.booking.start = ""; rerender();
    } else if (event.target.id === "leader-category") { state.leaderboard.category = event.target.value; rerender(); }
    else if (event.target.id === "leader-period") { state.leaderboard.period = event.target.value; rerender(); }
  });
  document.addEventListener("input", (event) => {
    if (event.target.id === "player-search") {
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
    const form = event.target;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const customer = { name: data.get("name").trim(), email: data.get("email").trim(), phone: data.get("phone").trim() };
    if (customer.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) || customer.phone.replace(/\D/g, "").length < 7) {
      showToast("Please enter a valid name, email, and phone number."); return;
    }
    state.booking.customer = customer; state.booking.step = 4; rerender();
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") modalRoot.innerHTML = "";
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && state.route === "leaderboard") {
      event.preventDefault(); document.querySelector("#player-search")?.focus();
    }
    if (event.key === "Enter" && event.target.matches("tr[data-player]")) showPlayer(event.target.dataset.player);
  });
  render();
})();
