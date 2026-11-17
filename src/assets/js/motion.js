/* oliMoto motion. Every effect here explains something:
   - the logo: the bike rides round the globe, clockwise, the way it faces
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
