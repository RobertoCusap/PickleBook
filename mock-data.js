/* Fictional content used only by the RallyCourt frontend demonstration. */
window.RALLY_DATA = (() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const courts = [
    { id: "c1", name: "The Center Court", type: "Indoor", surface: "Pro cushioned", price: 32, description: "Our flagship court, with tournament-grade lighting and plenty of room to play.", image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1000&q=85", tag: "Most popular", color: "green" },
    { id: "c2", name: "Garden Court", type: "Outdoor", surface: "Outdoor acrylic", price: 24, description: "Fresh air, open skies, and a little friendly competition in the garden.", image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1000&q=85", tag: "Open air", color: "blue" },
    { id: "c3", name: "The Northside", type: "Indoor", surface: "Pro cushioned", price: 28, description: "A comfortable all-weather court made for your after-work match.", image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1000&q=85", tag: "All-weather", color: "orange" },
    { id: "c4", name: "Sunset Court", type: "Outdoor", surface: "Outdoor acrylic", price: 22, description: "Catch golden-hour rallies on our relaxed, neighborhood favorite.", image: "https://images.unsplash.com/photo-1599586120429-48281b6f0b9a?auto=format&fit=crop&w=1000&q=85", tag: "Great value", color: "purple" },
  ];
  const reservations = [
    { courtId: "c1", date: iso(0), start: "09:00", duration: 1, status: "confirmed" },
    { courtId: "c1", date: iso(0), start: "17:00", duration: 2, status: "confirmed" },
    { courtId: "c2", date: iso(0), start: "10:00", duration: 1, status: "confirmed" },
    { courtId: "c3", date: iso(1), start: "18:00", duration: 1, status: "confirmed" },
    { courtId: "c4", date: iso(1), start: "12:00", duration: 2, status: "pending" },
    { courtId: "c1", date: iso(2), start: "08:00", duration: 1, status: "confirmed" },
    { courtId: "c2", date: iso(2), start: "19:00", duration: 1, status: "confirmed" },
    { courtId: "c3", date: iso(3), start: "16:00", duration: 2, status: "confirmed" },
    { courtId: "c4", date: iso(4), start: "09:00", duration: 1, status: "cancelled" },
    { courtId: "c1", date: iso(5), start: "14:00", duration: 1, status: "confirmed" },
    { courtId: "c2", date: iso(6), start: "11:00", duration: 2, status: "confirmed" },
    { courtId: "c3", date: iso(-1), start: "18:00", duration: 1, status: "confirmed" },
  ];
  const players = [
    { id: "p1", name: "Maya Chen", handle: "@mayaplays", avatar: "MC", color: "#c9e8d7", city: "Austin, TX", level: "4.5 · Advanced", matches: 128, wins: 94, losses: 34, movement: 2, points: { overall: { weekly: 480, monthly: 1710, all: 8420 }, singles: { weekly: 280, monthly: 990, all: 4960 }, doubles: { weekly: 200, monthly: 720, all: 3460 } }, results: ["W", "W", "L", "W", "W"] },
    { id: "p2", name: "Jordan Rivera", handle: "@jrivera", avatar: "JR", color: "#dce6fb", city: "Austin, TX", level: "4.0 · Advanced", matches: 116, wins: 82, losses: 34, movement: 1, points: { overall: { weekly: 450, monthly: 1620, all: 7940 }, singles: { weekly: 240, monthly: 880, all: 4380 }, doubles: { weekly: 210, monthly: 740, all: 3560 } }, results: ["W", "L", "W", "W", "W"] },
    { id: "p3", name: "Sam Patel", handle: "@sampatel", avatar: "SP", color: "#f9dfc8", city: "Round Rock, TX", level: "4.0 · Advanced", matches: 104, wins: 73, losses: 31, movement: -1, points: { overall: { weekly: 390, monthly: 1450, all: 7280 }, singles: { weekly: 260, monthly: 920, all: 4720 }, doubles: { weekly: 130, monthly: 530, all: 2560 } }, results: ["L", "W", "W", "L", "W"] },
    { id: "p4", name: "Alex Morgan", handle: "@alexm", avatar: "AM", color: "#eadcf7", city: "Austin, TX", level: "3.5 · Intermediate", matches: 92, wins: 61, losses: 31, movement: 3, points: { overall: { weekly: 360, monthly: 1320, all: 6710 }, singles: { weekly: 210, monthly: 750, all: 3890 }, doubles: { weekly: 150, monthly: 570, all: 2820 } }, results: ["W", "W", "W", "L", "W"] },
    { id: "p5", name: "Taylor Brooks", handle: "@tbrooks", avatar: "TB", color: "#f5e5b8", city: "Cedar Park, TX", level: "3.5 · Intermediate", matches: 84, wins: 53, losses: 31, movement: 0, points: { overall: { weekly: 330, monthly: 1170, all: 5980 }, singles: { weekly: 180, monthly: 620, all: 3140 }, doubles: { weekly: 150, monthly: 550, all: 2840 } }, results: ["L", "W", "W", "W", "L"] },
    { id: "p6", name: "Chris Walker", handle: "@chrisw", avatar: "CW", color: "#d9e8ed", city: "Austin, TX", level: "3.5 · Intermediate", matches: 78, wins: 46, losses: 32, movement: -2, points: { overall: { weekly: 290, monthly: 1030, all: 5420 }, singles: { weekly: 160, monthly: 560, all: 2940 }, doubles: { weekly: 130, monthly: 470, all: 2480 } }, results: ["W", "L", "L", "W", "L"] },
    { id: "p7", name: "Riley James", handle: "@rjames", avatar: "RJ", color: "#f3d9dc", city: "Georgetown, TX", level: "3.0 · Intermediate", matches: 67, wins: 38, losses: 29, movement: 1, points: { overall: { weekly: 250, monthly: 890, all: 4760 }, singles: { weekly: 140, monthly: 490, all: 2520 }, doubles: { weekly: 110, monthly: 400, all: 2240 } }, results: ["W", "W", "L", "W", "L"] },
    { id: "p8", name: "Avery Kim", handle: "@averyk", avatar: "AK", color: "#dcebd2", city: "Austin, TX", level: "3.0 · Intermediate", matches: 61, wins: 33, losses: 28, movement: -1, points: { overall: { weekly: 220, monthly: 760, all: 4130 }, singles: { weekly: 120, monthly: 430, all: 2230 }, doubles: { weekly: 100, monthly: 330, all: 1900 } }, results: ["L", "W", "L", "W", "W"] },
    { id: "p9", name: "Drew Thompson", handle: "@drewt", avatar: "DT", color: "#f0dfd3", city: "Pflugerville, TX", level: "2.5 · Developing", matches: 48, wins: 23, losses: 25, movement: 2, points: { overall: { weekly: 170, monthly: 610, all: 3320 }, singles: { weekly: 80, monthly: 300, all: 1620 }, doubles: { weekly: 90, monthly: 310, all: 1700 } }, results: ["W", "L", "W", "L", "W"] },
    { id: "p10", name: "Morgan Lee", handle: "@morganlee", avatar: "ML", color: "#dfdef4", city: "Austin, TX", level: "2.5 · Developing", matches: 42, wins: 19, losses: 23, movement: -1, points: { overall: { weekly: 140, monthly: 520, all: 2840 }, singles: { weekly: 70, monthly: 240, all: 1320 }, doubles: { weekly: 70, monthly: 280, all: 1520 } }, results: ["L", "W", "L", "L", "W"] },
    { id: "p11", name: "Casey Nguyen", handle: "@caseyn", avatar: "CN", color: "#ead5e7", city: "Round Rock, TX", level: "2.5 · Developing", matches: 39, wins: 17, losses: 22, movement: 0, points: { overall: { weekly: 120, monthly: 440, all: 2460 }, singles: { weekly: 60, monthly: 210, all: 1160 }, doubles: { weekly: 60, monthly: 230, all: 1300 } }, results: ["W", "L", "L", "W", "L"] },
  ];
  return { courts, reservations, players, dateOffset: iso };
})();
