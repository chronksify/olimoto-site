/* The way round, on the home page.
   - the route as a list of legs, built from the same waypoints the map uses
   - scrolling the list rides the map and runs the miles counter under it */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var html = document.documentElement, fmt = new Intl.NumberFormat("en-GB");
  var ROUTE = window.OLIMOTO_ROUTE || [];
  var TOTAL_MILES = 19000; // their own figure for the whole ride

  /* ---------- days to the start ---------- */
  var daysEl = $("[data-days]"), depart = Date.parse(html.dataset.depart || "");
  if (daysEl && depart) {
    var tick = function () { daysEl.textContent = String(Math.max(0, Math.floor((depart - Date.now()) / 86400000))); };
    tick(); setInterval(tick, 60000);
  }

  /* ---------- roadbook rows ---------- */
  var list = $("[data-legs]");
  if (!list || ROUTE.length < 2) return;

  function miles(a, b) { // great-circle distance, used only to share the 19,000 miles out along the route
    var R = 3959, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
    var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.pow(Math.sin(dLng / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  var NICE = { "New Zealand, south coast": "down to the south coast", "South coast of England": "the south coast" };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  // Group the legs into rows: one row per stretch of riding through a region, one per shipping leg.
  var rows = [];
  for (var i = 1; i < ROUTE.length; i++) {
    var p = ROUTE[i], ride = p.leg === "ride", last = rows[rows.length - 1];
    if (last && last.ride === ride && last.region === p.region) { last.legs.push(i); last.names.push(p.name); }
    else rows.push({ ride: ride, fly: p.leg === "fly", region: p.region, legs: [i], names: [p.name] });
  }
  var rideTotal = 0;
  rows.forEach(function (r) { r.raw = r.ride ? r.legs.reduce(function (s, i) { return s + miles(ROUTE[i - 1], ROUTE[i]); }, 0) : 0; rideTotal += r.raw; });
  var acc = 0;
  rows.forEach(function (r) { r.from = acc; acc += r.raw / rideTotal * TOTAL_MILES; r.to = acc; });

  var GLYPH = {
    ride: '<svg class="legs__glyph" viewBox="0 0 40 40" aria-hidden="true"><circle class="solid" cx="20" cy="33" r="3"/><path d="M20 30V9"/><path d="M12.5 16.5 20 8l7.5 8.5"/></svg>',
    fly: '<svg class="legs__glyph" viewBox="0 0 40 40" aria-hidden="true"><path d="M5 21 35 7 24 34l-5-10z"/><path d="M19 24 35 7"/></svg>',
    ship: '<svg class="legs__glyph" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 22h24l-4 7H12z"/><path d="M20 22V9"/><path d="M20 9l8 4-8 4"/><path d="M5 35q3.75-3 7.5 0t7.5 0 7.5 0 7.5 0"/></svg>'
  };
  list.innerHTML = rows.map(function (r, k) {
    var title, small;
    if (r.region === "London") { title = "Back to London"; small = "By air to Heathrow"; }
    else if (!r.ride) { title = "To " + r.region; small = r.region === "Spain" ? "By boat from the south coast" : r.fly ? "By air" : "Bikes shipped or flown"; }
    else if (r.region === "Britain") { title = "Scotland to the south coast"; small = "Official start in London, " + (html.dataset.londonLabel || ""); }
    else {
      title = cap(r.region);
      small = r.names.map(function (n) { return NICE[n] || n; }).filter(function (n) { return n.toLowerCase() !== r.region.toLowerCase(); }).join(", ");
    }
    r.title = title;
    var mi = r.ride || r.region === "London" ? '<span class="legs__mi">about ' + fmt.format(Math.round(r.to / 100) * 100) + " miles</span>" : "";
    return '<li><span class="legs__n">' + String(k + 1).padStart(2, "0") + "</span>" + (r.ride ? GLYPH.ride : r.fly ? GLYPH.fly : GLYPH.ship) +
      "<div><b>" + title + "</b>" + (small ? "<small>" + small + "</small>" : "") + "</div>" + mi + "</li>";
  }).join("");
  var items = $$("li", list);

  /* ---------- scrolling the rows rides the map ---------- */
  var trip = $("[data-trip]"), now = $("[data-way-now]"), mapBox = $("[data-way-map]"), phone = window.matchMedia("(max-width: 860px)");
  var legEls = {}, rider = null, lastNow = "", lastHere = -1;

  document.addEventListener("route:ready", function (e) {
    var svg = e.detail.querySelector("svg"); if (!svg) return;
    $$(".leg", svg).forEach(function (el) { legEls[+el.dataset.i] = { el: el, len: el.getTotalLength(), fly: el.classList.contains("fly") }; });
    var NS = "http://www.w3.org/2000/svg";
    rider = document.createElementNS(NS, "g");
    var bike = document.createElementNS(NS, "image");
    bike.setAttribute("href", "/assets/img/logo-bike.png"); bike.setAttribute("width", "40"); bike.setAttribute("height", "35"); bike.setAttribute("x", "-20"); bike.setAttribute("y", "-38");
    var dot = document.createElementNS(NS, "circle"); dot.setAttribute("class", "rider-dot"); dot.setAttribute("r", "6");
    // A pale badge behind the bike so it shows over both land and sea.
    var badge = document.createElementNS(NS, "circle"); badge.setAttribute("class", "rider-badge"); badge.setAttribute("r", "21"); badge.setAttribute("cy", "-22");
    rider.appendChild(badge); rider.appendChild(dot); rider.appendChild(bike); svg.appendChild(rider);
    update();
  });

  function update() {
    if (!items.length) return;
    // The reading line: halfway down the screen, or just under the map when the map is pinned above the rows (phones).
    var stacked = mapBox && phone.matches;
    var mapBottom = stacked ? mapBox.getBoundingClientRect().bottom : 0;
    var ref = stacked ? mapBottom + (window.innerHeight - mapBottom) * 0.35 : window.innerHeight * 0.5;
    var first = items[0].getBoundingClientRect(), end = items[items.length - 1].getBoundingClientRect();
    var k = -1, f = 0;
    if (ref <= first.top) { k = -1; }
    else if (ref >= end.bottom) { k = items.length; }
    else for (var j = 0; j < items.length; j++) { var b = items[j].getBoundingClientRect(); if (ref < b.bottom) { k = j; f = clamp((ref - b.top) / b.height, 0, 1); break; } }

    var pos = null, mi = k < 0 ? 0 : k >= rows.length ? TOTAL_MILES : rows[k].from + (rows[k].to - rows[k].from) * f;
    rows.forEach(function (r, j) {
      var done = j < k ? 1 : j > k ? 0 : f, total = r.legs.reduce(function (s, i) { return s + (legEls[i] ? legEls[i].len : 0); }, 0), want = done * total, run = 0;
      r.legs.forEach(function (i) {
        var L = legEls[i]; if (!L) return;
        var g = clamp((want - run) / (L.len || 1), 0, 1); run += L.len;
        if (L.fly) L.el.style.opacity = g > 0 ? String(0.35 + 0.65 * g) : "0"; else L.el.style.strokeDashoffset = String(1 - g);
        if (j === k && g > 0 && (g < 1 || !pos)) { var a = L.el.getPointAtLength(g * L.len), c = L.el.getPointAtLength(Math.min(L.len, g * L.len + 2)); pos = { x: a.x, y: a.y, left: c.x < a.x && Math.abs(c.x - a.x) < 30 }; }
      });
    });
    if (rider) {
      var L0 = legEls[1], Ln = legEls[ROUTE.length - 1];
      if (!pos && L0 && k < 0) { var s = L0.el.getPointAtLength(0); pos = { x: s.x, y: s.y, left: false }; }
      if (!pos && Ln && k >= rows.length) { var h = Ln.el.getPointAtLength(Ln.len); pos = { x: h.x, y: h.y, left: false }; }
      if (pos) rider.setAttribute("transform", "translate(" + pos.x.toFixed(1) + " " + pos.y.toFixed(1) + ")" + (pos.left ? " scale(-1 1)" : ""));
    }
    if (k !== lastHere) { items.forEach(function (li, j) { li.classList.toggle("is-here", j === k); }); lastHere = k; }
    if (trip) trip.textContent = k < 0 ? "" : "about " + fmt.format(Math.round(mi / 10) * 10) + " miles";
    if (now) {
      var r = rows[k], text = k < 0 ? "Start · Shirlaws, " + (html.dataset.departLabel || "") : k >= rows.length ? "Back in London"
        : r.region === "London" ? "Flying back to London" : r.ride ? "Riding through " + r.region : r.fly ? "Flying to " + r.region : r.region === "Spain" ? "By boat to Spain" : "Bikes shipped to " + r.region;
      if (text !== lastNow) { now.textContent = text; lastNow = text; }
    }
  }
  var ticking = false;
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
