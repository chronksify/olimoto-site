/* oliMoto site behaviour. Each feature only runs if its element is on the page. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Departure date and time come from the CMS (data/site.json), via data attributes on <html>.
  var html = document.documentElement;
  var DEPARTURE = Date.parse(html.dataset.depart || "2027-07-18T11:00:00Z");
  var DEPART_LABEL = html.dataset.departLabel || "18 July 2027", LONDON_LABEL = html.dataset.londonLabel || "21 July 2027";
  var PRE_JOURNEY = Date.now() < DEPARTURE;

  // Planned route, traced from oliMoto's own route map: Scotland, London, Portugal, east across
  // Europe and Asia, Australia, New Zealand, the USA west to east, then home. Points are rough
  // waypoints, not booked stops. leg = how they get TO this point. label = shown on the home map.
  var ROUTE = [
    { name: "Shirlaws, Aberdeenshire", label: "Start", lat: 57.15, lng: -2.1, date: DEPART_LABEL },
    { name: "London", region: "England", label: "London", lat: 51.51, lng: -0.13, date: LONDON_LABEL, leg: "ride" },
    { name: "Portugal", region: "Portugal", label: "Portugal", lat: 38.72, lng: -9.14, leg: "ship" },
    { name: "Spain", region: "Europe", lat: 40.4, lng: -3.7, leg: "ride" },
    { name: "Southern France", region: "Europe", lat: 43.7, lng: 7.26, leg: "ride" },
    { name: "Northern Italy", region: "Europe", lat: 45.4, lng: 12.3, leg: "ride" },
    { name: "The Balkans", region: "Europe", lat: 43.0, lng: 20.5, leg: "ride" },
    { name: "Turkey", region: "Turkey", label: "Turkey", lat: 41.0, lng: 28.97, leg: "ride" },
    { name: "Georgia", region: "the Caucasus", lat: 41.7, lng: 44.8, leg: "ride" },
    { name: "Azerbaijan", region: "the Caucasus", lat: 40.4, lng: 49.87, leg: "ride" },
    { name: "Kazakhstan", region: "Central Asia", label: "Central Asia", lat: 43.65, lng: 51.2, leg: "ship" },
    { name: "Central Asia", region: "Central Asia", lat: 46.5, lng: 58.0, leg: "ride" },
    { name: "Almaty", region: "Central Asia", lat: 43.2, lng: 76.9, leg: "ride" },
    { name: "Western China", region: "China", lat: 43.8, lng: 87.6, leg: "ride" },
    { name: "Central China", region: "China", label: "China", lat: 34.3, lng: 108.9, leg: "ride" },
    { name: "Eastern China", region: "China", lat: 30.5, lng: 119.0, leg: "ride" },
    { name: "Perth", region: "Australia", label: "Australia", lat: -31.95, lng: 115.86, leg: "ship" },
    { name: "Adelaide", region: "Australia", lat: -34.9, lng: 138.6, leg: "ride" },
    { name: "Melbourne", region: "Australia", lat: -37.8, lng: 144.96, leg: "ride" },
    { name: "New Zealand, South Island", region: "New Zealand", label: "New Zealand", lat: -43.5, lng: 172.6, leg: "ship" },
    { name: "New Zealand, North Island", region: "New Zealand", lat: -36.85, lng: 174.76, leg: "ride" },
    { name: "USA, west coast", region: "the USA", label: "USA", lat: 47.6, lng: -122.3, leg: "ship" },
    { name: "California", region: "the USA", lat: 37.8, lng: -122.4, leg: "ride" },
    { name: "Colorado", region: "the USA", lat: 39.7, lng: -105.0, leg: "ride" },
    { name: "Great Lakes", region: "the USA", lat: 41.9, lng: -87.6, leg: "ride" },
    { name: "USA, east coast", region: "the USA", lat: 42.36, lng: -71.06, leg: "ride" },
    { name: "Home", region: "home", lat: 57.15, lng: -2.1, leg: "ship" }
  ];
  window.OLIMOTO_ROUTE = ROUTE;

  /* ---------- helpers ---------- */
  function onView(el, fn, threshold) {
    if (!("IntersectionObserver" in window)) return fn();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { fn(); io.disconnect(); } });
    }, { threshold: threshold || 0.2 });
    io.observe(el);
  }
  function whileVisible(el, frame) {
    var on = false, raf = 0, last = 0;
    function tick(now) { var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; frame(dt, now / 1000); if (on) raf = requestAnimationFrame(tick); }
    if (reduce) { frame(0.016, 1); return; }
    if (!("IntersectionObserver" in window)) { on = true; raf = requestAnimationFrame(tick); return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !on) { on = true; last = performance.now(); raf = requestAnimationFrame(tick); }
        else if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf); }
      });
    }).observe(el);
  }
  function fit(c) {
    var r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return { w: w, h: h, d: d };
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- menu ---------- */
  var menuBtn = $(".menu-btn"), nav = $("#site-nav");
  if (menuBtn && nav) menuBtn.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "Close" : "Menu";
  });

  /* ---------- reveals ---------- */
  $$(".reveal").forEach(function (el) { onView(el, function () { el.classList.add("in"); }, 0.1); });
  $$(".stamps").forEach(function (el) {
    $$(".stamp", el).forEach(function (s, i) { s.style.setProperty("--d", (i * 0.12) + "s"); });
    onView(el, function () { el.classList.add("in"); }, 0.25);
  });

  /* ---------- countdown ---------- */
  $$("[data-countdown]").forEach(function (box) {
    var labels = ["Days", "Hrs", "Mins", "Secs"];
    box.innerHTML = labels.map(function (l) { return '<div><b>00</b><small>' + l.toUpperCase() + '</small></div>'; }).join("");
    var bs = $$("b", box);
    function update() {
      var s = Math.max(0, Math.floor((DEPARTURE - Date.now()) / 1000));
      var v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
      v.forEach(function (n, i) {
        var t = i === 0 ? String(n) : String(n).padStart(2, "0");
        if (bs[i].textContent !== t) { bs[i].textContent = t; if (!reduce) { bs[i].classList.remove("flip"); void bs[i].offsetWidth; bs[i].classList.add("flip"); } }
      });
      if (s === 0) { box.setAttribute("aria-label", "They are on the road"); }
    }
    box.setAttribute("role", "timer");
    box.setAttribute("aria-label", "Time until departure on " + DEPART_LABEL);
    update(); setInterval(update, 1000);
  });

  /* ---------- count up ---------- */
  $$("[data-count]").forEach(function (el) {
    var end = +el.dataset.count, fmt = new Intl.NumberFormat("en-GB");
    if (reduce) { el.textContent = fmt.format(end); return; }
    el.textContent = "0";
    onView(el, function () {
      var t0 = performance.now(), dur = 1600;
      (function step(now) { var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt.format(Math.round(end * e)); if (p < 1) requestAnimationFrame(step); })(t0);
    });
  });

  /* ---------- hero terrain: contour ridgelines ---------- */
  $$("canvas.terrain").forEach(function (c) {
    whileVisible(c, function (dt, t) {
      var s = fit(c), W = s.w, H = s.h, x = c.getContext("2d"), N = 30, top = H * 0.08, gap = (H * 1.02 - top) / N;
      x.clearRect(0, 0, W, H);
      for (var i = 0; i < N; i++) {
        var by = top + i * gap;
        x.beginPath(); x.moveTo(0, H);
        for (var px = 0; px <= W; px += 5 * s.d) {
          var u = px / W, amp = Math.exp(-Math.pow((u - 0.68) / 0.3, 2)) * H * 0.26 + H * 0.02;
          var n = Math.sin(u * 8 + i * 0.6 + t * 0.25) * 0.5 + Math.sin(u * 19 - i * 1.2 + t * 0.4) * 0.3 + Math.sin(u * 43 + i * 2.1 - t * 0.2) * 0.2;
          x.lineTo(px, by - amp * (n + 1) / 2);
        }
        x.lineTo(W, H); x.closePath();
        x.fillStyle = "#36402a"; x.fill();
        x.strokeStyle = i % 5 === 0 ? "rgba(217,201,163,.9)" : "rgba(217,201,163,.4)";
        x.lineWidth = (i % 5 === 0 ? 1.6 : 1) * s.d; x.stroke();
      }
    });
  });

  /* ---------- route drawing (home) ---------- */
  // The map libraries load after this script, so wait for them.
  if ($("[data-route]")) { if (window.d3 && window.topojson) drawRoutes(); else window.addEventListener("load", drawRoutes); }
  function drawRoutes() { $$("[data-route]").forEach(function (wrap) {
    // Real world map (Natural Earth outline), route drawn leg by leg in riding order.
    if (!window.d3 || !d3.geoNaturalEarth1 || !window.topojson) return;
    var W = 1000, H = 520;
    var proj = d3.geoNaturalEarth1().scale(190).translate([W / 2 - 10, H / 2 + 20]);
    var path = d3.geoPath(proj);
    var key = '<div class="route-key"><span><i></i>Riding</span><span><i class="fly"></i>Bike shipped or flown</span><span><i class="live"></i>' +
      (PRE_JOURNEY ? "Live position, from " + DEPART_LABEL : "Last reported position") + '</span><span class="route-note">Planned route. Countries may change.</span></div>';
    fetch("/assets/vendor/land-110m.json").then(function (r) { return r.json(); }).then(function (topo) {
      var land = path(topojson.feature(topo, topo.objects.land));
      var legs = "", delay = 0;
      for (var i = 1; i < ROUTE.length; i++) {
        var a = ROUTE[i - 1], b = ROUTE[i], ride = b.leg === "ride";
        var d = path({ type: "LineString", coordinates: [[a.lng, a.lat], [b.lng, b.lat]] });
        if (!d) continue;
        // pathLength="1" lets the draw-on animation work without measuring each line.
        legs += '<path data-i="' + i + '" class="leg draw' + (ride ? '" pathLength="1" style="--len:1;' : ' fly" style="') + '--d:' + delay.toFixed(2) + 's" d="' + d + '"/>';
        delay += ride ? 0.12 : 0.3;
      }
      var labels = ROUTE.filter(function (p) { return p.label; }).map(function (p) {
        var q = proj([p.lng, p.lat]), below = /Australia|New Zealand|Portugal/.test(p.label), left = /London|Portugal|Start|New Zealand/.test(p.label);
        var tx = q[0] + (left ? -12 : 12), ty = q[1] + (below ? 22 : -10);
        if (p.label === "Start") ty = q[1] - 12;
        return '<circle class="stop" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="4.5"/>' +
          '<text' + (/London|Portugal|Turkey|Central Asia/.test(p.label) ? ' class="minor"' : "") + ' x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="' + (left ? "end" : "start") + '">' + esc(p.label.toUpperCase()) + '</text>';
      }).join("");
      // Pre-journey the live marker waits at the start. During the ride it moves to the last GPS fix.
      var s = proj([ROUTE[0].lng, ROUTE[0].lat]);
      var marker = '<g class="live"><circle class="ring" cx="' + s[0] + '" cy="' + s[1] + '" r="10"/><circle class="dot" cx="' + s[0] + '" cy="' + s[1] + '" r="6"/></g>';
      wrap.innerHTML = '<svg class="route-svg route-svg--world" viewBox="0 40 ' + W + ' ' + (H - 70) + '" role="img" aria-label="Planned route: from Aberdeenshire to London, by boat to Portugal, east across Europe, Turkey, Central Asia and China, then Australia, New Zealand, the USA from west to east, and home">' +
        '<path class="land" d="' + land + '"/>' + legs + labels + marker + '</svg>' + key;
      // On the home page scrolling rides the route (motion.js). Elsewhere it draws itself once in view.
      if (reduce || !wrap.closest("[data-ride]")) { if (reduce) wrap.classList.add("in"); else onView(wrap, function () { wrap.classList.add("in"); }, 0.25); }
      document.dispatchEvent(new CustomEvent("route:ready", { detail: wrap }));
    }).catch(function () { wrap.innerHTML = key; });
  }); }

  /* ---------- interactive map (expedition) ---------- */
  var mapEl = $("[data-map]");
  if (mapEl && window.L) {
    var map = L.map(mapEl, { scrollWheelZoom: false, worldCopyJump: true }).setView([30, 40], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 7, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    // Unwrap longitudes so the Pacific crossing goes east from New Zealand, not back across Asia.
    var ll = [], prev = null;
    ROUTE.forEach(function (p) { var lng = p.lng; if (prev !== null) { while (lng - prev > 180) lng -= 360; while (prev - lng > 180) lng += 360; } prev = lng; ll.push([p.lat, lng]); });
    for (var k = 1; k < ll.length; k++) {
      var fly = ROUTE[k].leg !== "ride";
      L.polyline([ll[k - 1], ll[k]], { color: fly ? "#5b5c4f" : "#4d5a3a", weight: fly ? 2 : 4, dashArray: fly ? "2 8" : null }).addTo(map);
    }
    ROUTE.forEach(function (p, k) {
      if (!p.label && !p.date) return;
      L.circleMarker(ll[k], { radius: 7, color: "#4d5a3a", weight: 3, fillColor: "#f3eee1", fillOpacity: 1 })
        .addTo(map).bindPopup("<b>" + esc(p.name) + "</b>" + (p.date ? "<br>" + p.date : ""));
    });
    L.marker(ll[0], { icon: L.divIcon({ className: "", html: '<div class="live-pin"></div>', iconSize: [18, 18] }), title: "Live position" })
      .addTo(map).bindPopup(PRE_JOURNEY ? "<b>Live position</b><br>Shows here from " + DEPART_LABEL + "." : "<b>Last reported position</b>");
    map.fitBounds(ll, { padding: [24, 24] });
  }

  /* ---------- rider card tilt ---------- */
  if (!reduce && window.matchMedia("(hover: hover)").matches) $$("[data-tilt]").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty("--ry", ((px - 0.5) * 10) + "deg"); card.style.setProperty("--rx", ((0.5 - py) * 10) + "deg");
      card.style.setProperty("--mx", px * 100 + "%"); card.style.setProperty("--my", py * 100 + "%");
    });
    card.addEventListener("pointerleave", function () { card.style.setProperty("--ry", "0deg"); card.style.setProperty("--rx", "0deg"); });
  });

  /* ---------- sponsor lanyard ---------- */
  $$("[data-lanyard]").forEach(function (box) {
    var rig = $(".rig", box), ang = 0.45, vel = 0, drag = false, target = 0;
    function aim(e) { var r = box.getBoundingClientRect(); target = Math.atan2(-(e.clientX - (r.left + r.width / 2)), Math.max(40, e.clientY - r.top)); }
    box.addEventListener("pointerdown", function (e) { drag = true; box.setPointerCapture(e.pointerId); box.style.cursor = "grabbing"; aim(e); });
    box.addEventListener("pointermove", function (e) { if (drag) aim(e); });
    box.addEventListener("pointerup", function () { drag = false; box.style.cursor = "grab"; });
    if (reduce) { rig.style.transform = "rotate(0)"; return; }
    whileVisible(box, function (dt) {
      if (drag) { var prev = ang; ang += (target - ang) * Math.min(1, dt * 16); vel = (ang - prev) / dt; }
      else { vel += -9 * Math.sin(ang) * dt; vel *= Math.pow(0.4, dt); ang += vel * dt; }
      rig.style.transform = "rotate(" + ang + "rad)";
    });
  });

  /* ---------- live page radar ---------- */
  $$("[data-radar]").forEach(function (box) {
    var c = $("canvas", box), x = c.getContext("2d");
    whileVisible(box, function (dt, t) {
      var s = fit(c), W = s.w, H = s.h, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.48, a = (t * 1.1) % (Math.PI * 2);
      x.fillStyle = "rgba(15,20,16,.28)"; x.fillRect(0, 0, W, H);
      x.strokeStyle = "rgba(159,224,169,.2)"; x.lineWidth = s.d;
      for (var k = 1; k <= 4; k++) { x.beginPath(); x.arc(cx, cy, R * k / 4, 0, 7); x.stroke(); }
      x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy); x.moveTo(cx, cy - R); x.lineTo(cx, cy + R); x.stroke();
      for (var w = 0; w < 22; w++) { x.fillStyle = "rgba(159,224,169," + (0.16 * (1 - w / 22)) + ")"; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, a - (w + 1) * 0.035, a - w * 0.035); x.closePath(); x.fill(); }
      var d = ((a + 0.9) % (Math.PI * 2)), al = Math.max(0, 1 - d / 3);
      x.fillStyle = "rgba(255,106,19," + Math.max(0.35, al) + ")"; x.beginPath(); x.arc(cx + Math.cos(-0.9) * R * 0.3, cy + Math.sin(-0.9) * R * 0.3, 6 * s.d, 0, 7); x.fill();
    });
  });

  /* ---------- spark on donate buttons ---------- */
  $$("[data-spark]").forEach(function (btn) {
    var c = document.createElement("canvas"); c.setAttribute("aria-hidden", "true"); btn.appendChild(c);
    var x = c.getContext("2d"), bits = [], running = false;
    btn.addEventListener("click", function () {
      if (reduce) return;
      for (var i = 0; i < 16; i++) bits.push({ a: i / 16 * Math.PI * 2, life: 1, sp: 90 + Math.random() * 60 });
      if (!running) { running = true; var last = performance.now(); requestAnimationFrame(function step(now) {
        var dt = (now - last) / 1000; last = now; var s = fit(c); x.clearRect(0, 0, s.w, s.h);
        bits = bits.filter(function (b) { b.life -= dt * 2.4; return b.life > 0; });
        bits.forEach(function (b, i) { var dd = (1 - b.life) * b.sp * s.d, l = 14 * s.d * b.life; x.strokeStyle = i % 2 ? "#ff6a13" : "#d9c9a3"; x.lineWidth = 3 * s.d; x.beginPath(); x.moveTo(s.w / 2 + Math.cos(b.a) * (dd + 40 * s.d), s.h / 2 + Math.sin(b.a) * (dd + 22 * s.d)); x.lineTo(s.w / 2 + Math.cos(b.a) * (dd + 40 * s.d + l), s.h / 2 + Math.sin(b.a) * (dd + 22 * s.d + l)); x.stroke(); });
        if (bits.length) requestAnimationFrame(step); else running = false;
      }); }
    });
  });

  /* ---------- Netlify forms (newsletter, sponsor, contact) ---------- */
  $$("form[data-ajax]").forEach(function (form) {
    var status = $(".form-status", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status small"; status.textContent = "Sending…";
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(new FormData(form)).toString() })
        .then(function (r) {
          if (!r.ok) throw r;
          form.reset(); status.classList.add("ok"); status.textContent = form.dataset.success || "Thanks, you're signed up.";
        })
        .catch(function () { status.classList.add("err"); status.textContent = location.hostname === "localhost" ? "Forms work once the site is on Netlify." : "That didn't send. Check your connection and try again."; });
    });
  });

  /* ---------- supporter messages ---------- */
  function timeAgo(iso) {
    var d = new Date(iso), s = (Date.now() - d) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " hr ago";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: s > 300 * 86400 ? "numeric" : undefined });
  }
  function renderMsg(m) {
    var el = document.createElement("article"); el.className = "msg";
    var p = document.createElement("p"); p.textContent = m.message;
    var f = document.createElement("footer"), who = document.createElement("span"), b = document.createElement("b");
    b.textContent = m.name; who.appendChild(b); if (m.place) who.appendChild(document.createTextNode(" · " + m.place));
    var when = document.createElement("time"); when.dateTime = m.createdAt; when.textContent = timeAgo(m.createdAt);
    f.appendChild(who); f.appendChild(when); el.appendChild(p); el.appendChild(f); return el;
  }
  $$("[data-wall]").forEach(function (wall) {
    var limit = +wall.dataset.limit || 60;
    fetch("/api/messages", { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw r; return r.json(); })
      .then(function (d) {
        var list = (d.messages || []).slice(0, limit);
        wall.innerHTML = "";
        if (!list.length) { wall.innerHTML = '<p class="wall-empty">No messages yet. Be the first to wish Oli and Joe luck before they set off.</p>'; return; }
        list.forEach(function (m) { wall.appendChild(renderMsg(m)); });
      })
      .catch(function () {
        wall.innerHTML = '<p class="wall-empty">' + (location.hostname === "localhost" ? "Messages load here once the site is on Netlify. This preview has no message store." : "Messages couldn't load just now. Try refreshing.") + "</p>";
      });
  });
  $$("[data-message-form]").forEach(function (form) {
    var status = $(".form-status", form), ta = $("textarea", form), counter = $(".counter", form), max = +ta.getAttribute("maxlength");
    function count() { var n = ta.value.length; counter.textContent = n + " / " + max; counter.classList.toggle("over", n > max); }
    ta.addEventListener("input", count); count();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      $$("[aria-invalid]", form).forEach(function (el) { el.removeAttribute("aria-invalid"); });
      var data = Object.fromEntries(new FormData(form).entries());
      var btn = $("button[type=submit]", form); btn.disabled = true;
      status.className = "form-status"; status.textContent = "Sending…";
      fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { r: r, b: b }; }); })
        .then(function (res) {
          if (res.r.status === 202) {
            form.reset(); count(); status.classList.add("ok");
            status.textContent = "Thanks! Joe reads every message before it goes up, so yours will appear once he's approved it.";
          } else if (res.r.status === 422 || res.r.status === 429) {
            status.classList.add("err"); status.textContent = res.b.error || "That message can't be sent.";
            var bad = res.b.field && form.elements[res.b.field]; if (bad) { bad.setAttribute("aria-invalid", "true"); bad.focus(); }
          } else throw res.r;
        })
        .catch(function () { status.classList.add("err"); status.textContent = location.hostname === "localhost" ? "Messages can't be sent from this preview. They will work once the site is on Netlify." : "That didn't send. Check your connection and try again."; })
        .finally(function () { btn.disabled = false; });
    });
  });

  /* ---------- moderation page ---------- */
  var mod = $("[data-moderate]");
  if (mod) {
    var keyForm = $("#mod-key-form", mod), out = $("#mod-out", mod), modStatus = $("#mod-status", mod), key = "";
    try { key = sessionStorage.getItem("olimoto-mod") || ""; } catch (e) {}
    function call(method, body) {
      return fetch("/api/moderate", { method: method, headers: { "content-type": "application/json", "x-moderation-key": key }, body: body ? JSON.stringify(body) : undefined })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { if (!r.ok) throw b; return b; }); });
    }
    function item(m, actions) {
      var el = document.createElement("div"); el.className = "mod-item";
      el.appendChild(renderMsg(m));
      var row = document.createElement("div"); row.className = "btn-row";
      actions.forEach(function (a) {
        var b = document.createElement("button"); b.type = "button"; b.className = "btn " + (a[1] === "approve" ? "btn--hivis" : "btn--line"); b.textContent = a[0];
        b.onclick = function () { b.disabled = true; call("POST", { key: m.key, action: a[1] }).then(load, function (err) { modStatus.textContent = err.error || "That didn't work."; b.disabled = false; }); };
        row.appendChild(b);
      });
      el.appendChild(row); return el;
    }
    function load() {
      modStatus.textContent = "Loading…";
      call("GET").then(function (d) {
        keyForm.hidden = true; out.innerHTML = "";
        var h = document.createElement("h2"); h.textContent = "Waiting for you (" + d.pending.length + ")"; out.appendChild(h);
        var pl = document.createElement("div"); pl.className = "mod-list"; out.appendChild(pl);
        if (!d.pending.length) pl.innerHTML = '<p class="wall-empty">Nothing to check. New messages appear here.</p>';
        d.pending.forEach(function (m) { pl.appendChild(item(m, [["Approve", "approve"], ["Reject", "reject"]])); });
        var h2 = document.createElement("h2"); h2.textContent = "On the wall (" + d.approved.length + ")"; h2.style.marginTop = "48px"; out.appendChild(h2);
        var al = document.createElement("div"); al.className = "mod-list"; out.appendChild(al);
        d.approved.forEach(function (m) { al.appendChild(item(m, [["Take down", "remove"]])); });
        modStatus.textContent = "";
      }, function (err) { keyForm.hidden = false; modStatus.textContent = (err && err.error) || (location.hostname === "localhost" ? "Moderation works once the site is on Netlify." : "Couldn't load messages."); });
    }
    keyForm.addEventListener("submit", function (e) { e.preventDefault(); key = $("#mod-key", mod).value.trim(); try { sessionStorage.setItem("olimoto-mod", key); } catch (er) {} load(); });
    if (key) load();
  }
})();
