/* Supporter post maker. Builds the animated "Official supporter" post in the browser:
   the logo bike rides round the globe, then the supporter's logo and the lines come in.
   Nothing is uploaded; the supporter logo stays on this computer. */
(function () {
  "use strict";
  var canvas = document.querySelector("[data-studio]");
  if (!canvas || !window.OLIMOTO_LOGO) return;
  var form = document.querySelector("[data-studio-form]");
  var status = document.querySelector("[data-studio-status]");
  var LOGO = window.OLIMOTO_LOGO;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ease = function (p) { return 1 - Math.pow(1 - clamp(p, 0, 1), 3); };
  var DUR = 7;
  var supporter = null, layers = null, raf = 0;

  function opts() {
    var f = new FormData(form);
    return { bg: f.get("bg"), size: f.get("size"), head: f.get("head") || "", lines: String(f.get("lines") || "").split("\n").filter(Boolean), url: f.get("url") || "" };
  }
  function setSize(o) { canvas.width = 1080; canvas.height = o.size === "story" ? 1920 : 1080; }

  function frame(x, o, t) {
    var W = canvas.width, H = canvas.height, dark = o.bg === "black";
    x.fillStyle = dark ? "#000" : "#fff"; x.fillRect(0, 0, W, H);
    var unit = W / 1080, story = H > W, top = story ? 300 : 60;
    // Layout in 1080-wide units: [logo size, gap to heading, gap to supporter logo, logo box height, gap to lines, line spacing, gap to web address]
    var G = story ? [380, 90, 60, 420, 110, 66, 80] : [240, 75, 40, 230, 85, 60, 75];
    // 1. The round logo, with the bike riding one lap clockwise.
    var S = G[0] * unit;
    LOGO.draw(x, layers, (W - S) / 2, top * unit, S, t);
    // 2. "Official supporter", in the teal-to-green of their posts.
    var y = top * unit + S + G[1] * unit, a = ease((t - 2.7) / 0.6);
    x.save(); x.globalAlpha = a; x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.font = "700 " + Math.round(64 * unit) + "px Montserrat, Arial, sans-serif";
    var hw = x.measureText(o.head.toUpperCase()).width, gr = x.createLinearGradient(W / 2 - hw / 2, 0, W / 2 + hw / 2, 0);
    gr.addColorStop(0, "#1c93b8"); gr.addColorStop(1, "#5fc04b");
    x.fillStyle = gr; x.fillText(o.head.toUpperCase(), W / 2, y + (1 - a) * 30 * unit);
    x.restore();
    // 3. The supporter's logo scales in.
    var boxH = G[3] * unit, boxW = W * 0.62, by = y + G[2] * unit;
    if (supporter) {
      var s = Math.min(boxW / supporter.width, boxH / supporter.height), w = supporter.width * s, h = supporter.height * s, p = ease((t - 3.1) / 0.7);
      x.save(); x.globalAlpha = p; x.translate(W / 2, by + boxH / 2); x.scale(0.85 + 0.15 * p, 0.85 + 0.15 * p);
      x.drawImage(supporter, -w / 2, -h / 2, w, h); x.restore();
    } else if (t > 3.1) {
      x.save(); x.strokeStyle = dark ? "#555" : "#bbb"; x.setLineDash([12 * unit, 10 * unit]); x.lineWidth = 3 * unit;
      x.strokeRect(W / 2 - boxW / 2, by, boxW, boxH);
      x.fillStyle = dark ? "#888" : "#888"; x.font = "500 " + Math.round(32 * unit) + "px Montserrat, Arial, sans-serif"; x.textAlign = "center";
      x.fillText("Choose the supporter's logo", W / 2, by + boxH / 2 + 10 * unit); x.restore();
    }
    // 4. The lines, one after another.
    var ly = by + boxH + G[4] * unit;
    x.save(); x.textAlign = "center"; x.fillStyle = dark ? "#fff" : "#1c3c8c";
    x.font = "800 " + Math.round((story ? 52 : 46) * unit) + "px Montserrat, Arial, sans-serif";
    o.lines.forEach(function (line, i) {
      var q = ease((t - 3.8 - i * 0.25) / 0.5);
      x.globalAlpha = q; x.fillText(line.toUpperCase(), W / 2, ly + i * G[5] * unit + (1 - q) * 24 * unit);
    });
    var uq = ease((t - 4.8) / 0.5);
    x.globalAlpha = uq; x.font = "800 " + Math.round(48 * unit) + "px Montserrat, Arial, sans-serif";
    x.fillText(o.url.toUpperCase(), W / 2, ly + (o.lines.length - 1) * G[5] * unit + G[6] * unit);
    x.restore();
  }

  function play(onDone) {
    cancelAnimationFrame(raf);
    var o = opts(); setSize(o);
    var x = canvas.getContext("2d"), t0 = performance.now();
    (function step(now) {
      var t = (now - t0) / 1000;
      frame(x, o, Math.min(t, DUR));
      if (t < DUR) raf = requestAnimationFrame(step); else if (onDone) onDone();
    })(t0);
  }

  function pickType() {
    var types = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    for (var i = 0; i < types.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported(types[i])) return types[i];
    return "";
  }
  function record() {
    var type = pickType();
    if (!type || !canvas.captureStream) { status.textContent = "This browser can't record video. Try Chrome or Edge."; return; }
    var chunks = [], rec = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 8000000 });
    rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      var ext = type.indexOf("mp4") > -1 ? "mp4" : "webm", name = "olimoto-supporter-" + (opts().size === "story" ? "story" : "post") + "." + ext;
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(chunks, { type: type.split(";")[0] })); a.download = name; a.click();
      status.textContent = ext === "mp4" ? "Saved as an MP4." : "Saved as a WebM. Instagram may need it converted to MP4.";
    };
    status.textContent = "Recording, about " + DUR + " seconds…";
    rec.start(); play(function () { setTimeout(function () { rec.stop(); }, 200); });
  }

  form.addEventListener("change", function (e) {
    if (e.target.name === "logo" && e.target.files[0]) {
      var img = new Image(); img.onload = function () { supporter = img; play(); }; img.src = URL.createObjectURL(e.target.files[0]);
    } else play();
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); record(); });
  document.querySelector("[data-studio-replay]").addEventListener("click", function () { play(); });

  // For checking a single moment of the animation, e.g. OLIMOTO_STUDIO.at(7) for the last frame.
  window.OLIMOTO_STUDIO = { at: function (t) { cancelAnimationFrame(raf); var o = opts(); setSize(o); frame(canvas.getContext("2d"), o, t); } };

  LOGO.layers().then(function (L) { layers = L; (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { play(); }); });
})();
