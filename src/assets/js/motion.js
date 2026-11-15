/* oliMoto motion. Every effect here explains something:
   - the logo: the bike rides round the globe, clockwise, the way it faces
   - the route: scrolling rides the planned route leg by leg, so the order is clear
   - the fundraising bar fills to the real total
   With reduced motion turned on, everything shows in its finished state. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ease = function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };

  /* ---------- logo: bike rides round the globe ---------- */
  // Layers cut from the official round logo (667 x 667). Globe centre 332.5, 335.5. Bike drawn at 252, 38.
  var imgs = null;
  function load(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
  function logoLayers() {
    return imgs || (imgs = Promise.all(["/assets/img/logo-ring.png", "/assets/img/logo-globe.png", "/assets/img/logo-bike.png"].map(load)));
  }
  var LOGO_DUR = 3.1;
  // Draws the logo as it looks t seconds into the animation. Any t past LOGO_DUR is the finished logo.
  function drawLogo(x, L, ox, oy, S, t) {
    var k = S / 667, cx = ox + 332.5 * k, cy = oy + 335.5 * k;
    var ring = L[0], globe = L[1], bike = L[2];
    var pop = ease(clamp(t / 0.45, 0, 1));
    x.save();
    x.globalAlpha = pop;
    x.fillStyle = "#fff";
    x.beginPath(); x.arc(ox + 333.5 * k, oy + 333.5 * k, 326 * k, 0, Math.PI * 2); x.fill();
    var gs = 0.72 + 0.28 * pop;
    x.drawImage(globe, cx - 162 * k * gs, cy - 162 * k * gs, 324 * k * gs, 324 * k * gs);
    x.restore();
    // One lap, clockwise from the top. The ring and web address are drawn in behind the bike.
    var lap = ease(clamp((t - 0.45) / 2.4, 0, 1)), ang = lap * Math.PI * 2;
    if (lap > 0) {
      x.save();
      x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, 420 * k, -Math.PI / 2, -Math.PI / 2 + ang, false); x.closePath(); x.clip();
      x.drawImage(ring, ox, oy, S, S);
      x.restore();
    }
    var drop = ease(clamp((t - 0.1) / 0.4, 0, 1));
    x.save();
    x.globalAlpha = drop;
    x.translate(cx, cy); x.rotate(ang);
    x.drawImage(bike, (252 - 332.5) * k, (38 - 335.5 - (1 - drop) * 60) * k, 172 * k, 152 * k);
    x.restore();
  }
  window.OLIMOTO_LOGO = { draw: drawLogo, layers: logoLayers, duration: LOGO_DUR };

  function playLogo(canvas) {
    logoLayers().then(function (L) {
      var r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
      var S = Math.round(r.width * d); canvas.width = S; canvas.height = S;
      var x = canvas.getContext("2d");
      if (reduce) { x.clearRect(0, 0, S, S); drawLogo(x, L, 0, 0, S, 99); return; }
      if (canvas._raf) cancelAnimationFrame(canvas._raf);
      var t0 = performance.now();
      (function frame(now) {
        var t = (now - t0) / 1000;
        x.clearRect(0, 0, S, S); drawLogo(x, L, 0, 0, S, t);
        if (t < LOGO_DUR) canvas._raf = requestAnimationFrame(frame);
      })(t0);
    });
  }
  $$("canvas[data-logo]").forEach(function (c) {
    var mode = c.dataset.logo;
    if (mode === "view" && "IntersectionObserver" in window && !reduce) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { playLogo(c); io.disconnect(); } }); }, { threshold: 0.6 });
      io.observe(c);
    } else if (mode === "once") {
      // Header mark: plays on the first page of a visit, then sits still until hovered.
      var seen = false; try { seen = sessionStorage.getItem("olimoto-logo") === "1"; sessionStorage.setItem("olimoto-logo", "1"); } catch (e) {}
      if (seen) { logoLayers().then(function (L) { var d = Math.min(2, window.devicePixelRatio || 1), S = Math.round(c.getBoundingClientRect().width * d); c.width = S; c.height = S; drawLogo(c.getContext("2d"), L, 0, 0, S, 99); }); }
      else playLogo(c);
    } else playLogo(c);
    var host = c.closest("a, button");
    if (host && !reduce) host.addEventListener("mouseenter", function () { playLogo(c); });
  });

  /* ---------- route: scrolling rides the planned route ---------- */
  function ride(wrap) {
    var section = wrap.closest("[data-ride]");
    var svg = wrap.querySelector("svg");
    if (!section || !svg || reduce) return;
    var ROUTE = window.OLIMOTO_ROUTE || [];
    var legs = $$(".leg", svg).map(function (p) {
      var len = p.getTotalLength(), fly = p.classList.contains("fly");
      return { el: p, len: len, w: fly ? len * 0.35 : len, fly: fly, i: +p.dataset.i };
    });
    var total = legs.reduce(function (s, l) { return s + l.w; }, 0);
    var NS = "http://www.w3.org/2000/svg";
    var g = document.createElementNS(NS, "g"); g.setAttribute("class", "rider");
    var im = document.createElementNS(NS, "image");
    im.setAttribute("href", "/assets/img/logo-bike.png"); im.setAttribute("width", "34"); im.setAttribute("height", "30");
    im.setAttribute("x", "-17"); im.setAttribute("y", "-29");
    g.appendChild(im); svg.appendChild(g);
    var readout = section.querySelector("[data-ride-readout]");
    var last = "";
    function update() {
      var r = section.getBoundingClientRect(), span = section.offsetHeight - window.innerHeight;
      var p = span > 0 ? clamp(-r.top / span, 0, 1) : 1, D = p * total, acc = 0, here = null;
      legs.forEach(function (l) {
        var f = clamp((D - acc) / l.w, 0, 1);
        if (l.fly) l.el.style.opacity = f > 0 ? String(0.35 + 0.65 * f) : "0";
        else l.el.style.strokeDashoffset = String(1 - f);
        if (f > 0 && f < 1) here = { l: l, f: f };
        acc += l.w;
      });
      var l0 = legs[0], pt, ahead, leg;
      if (here) { leg = here.l; pt = leg.el.getPointAtLength(here.f * leg.len); ahead = leg.el.getPointAtLength(Math.min(leg.len, here.f * leg.len + 2)); }
      else if (p >= 1) { leg = legs[legs.length - 1]; pt = leg.el.getPointAtLength(leg.len); ahead = { x: pt.x + 1, y: pt.y }; }
      else { leg = l0; pt = l0.el.getPointAtLength(0); ahead = l0.el.getPointAtLength(2); }
      var dx = ahead.x - pt.x, dy = ahead.y - pt.y, a = Math.atan2(dy, dx) * 180 / Math.PI, left = dx < 0;
      if (Math.abs(dx) > 30) a = 0; // the jump where the Pacific leg wraps round the map edge
      var tilt = left ? a + 180 : a; if (tilt > 180) tilt -= 360;
      a = leg.fly ? 0 : clamp(tilt, -40, 40); // level on a boat or plane, leaning into hills on the road
      if (left) a -= 180;
      g.setAttribute("transform", "translate(" + pt.x.toFixed(1) + " " + pt.y.toFixed(1) + ") rotate(" + (left ? a + 180 : a).toFixed(1) + ") scale(" + (left ? -1 : 1) + " 1)");
      g.style.opacity = p > 0.002 && p < 0.998 ? "1" : "0";
      if (readout) {
        var stop = ROUTE[leg.i] || {}, text;
        if (p <= 0.002) text = "Start · Shirlaws, " + (document.documentElement.dataset.departLabel || "");
        else if (p >= 0.998) text = "Home · about 19,000 miles";
        else text = (leg.fly ? "Bikes shipped to " : "Riding through ") + (stop.region || stop.name || "");
        if (!leg.fly && stop.region === "England") text = "Riding to London · " + (document.documentElement.dataset.londonLabel || "");
        if (stop.region === "home") text = "Heading home";
        if (text !== last) { readout.textContent = text; last = text; }
      }
    }
    var ticking = false;
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
    window.addEventListener("resize", update);
    section.classList.add("is-riding");
    update();
  }
  document.addEventListener("route:ready", function (e) { ride(e.detail); });

  /* ---------- fundraising bar fills to the real total ---------- */
  $$(".raised").forEach(function (box) {
    var b = box.querySelector("[data-gbp]"), end = b ? +b.dataset.gbp : 0, fmt = new Intl.NumberFormat("en-GB");
    // Swap in the live JustGiving total. If it can't be fetched, the saved total stays.
    fetch("/api/fundraising").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || d.source !== "justgiving" || !(d.raised >= 0)) return;
      var target = d.target || +box.dataset.target;
      end = d.raised;
      box.setAttribute("aria-label", "£" + fmt.format(d.raised) + " raised of a £" + fmt.format(target) + " target");
      var t = box.querySelector("[data-gbp-target]"); if (t) t.textContent = "£" + fmt.format(target);
      var bar = box.querySelector(".raised__bar span"); if (bar) bar.style.width = Math.min(100, d.raised / target * 100).toFixed(1) + "%";
      var asof = box.querySelector("[data-asof]"); if (asof) asof.textContent = "Live from the JustGiving page";
      if (b && !counting) b.textContent = "£" + fmt.format(end);
    }).catch(function () {});
    var counting = false;
    if (reduce || !("IntersectionObserver" in window)) { box.classList.add("in"); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect(); box.classList.add("in");
        if (!b) return;
        // Count up from £0 only once it's on screen, so the real total shows if this never runs.
        counting = true;
        var t0 = performance.now();
        (function step(now) { var q = clamp((now - t0) / 1400, 0, 1); b.textContent = "£" + fmt.format(Math.round(end * ease(q))); if (q < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: 0.5 });
    io.observe(box);
  });

  /* ---------- newspaper straightens as it comes into view ---------- */
  $$("[data-settle]").forEach(function (el) {
    if (reduce) return;
    function update() {
      var r = el.getBoundingClientRect(), vh = window.innerHeight;
      var q = clamp((vh - r.top) / (vh * 0.9), 0, 1);
      el.style.setProperty("--settle", String(q));
    }
    window.addEventListener("scroll", function () { requestAnimationFrame(update); }, { passive: true });
    update();
  });
})();
