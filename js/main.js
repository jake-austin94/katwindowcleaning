/* KAT Window Cleaning: site behaviour (built on the T M Professional Window Cleaning site)
   1. Header, navigation and mobile action bar
   2. The hero window: a real photo under grime the visitor wipes clean
   3. Quote form (validation, then the KAT enquiry workflow in n8n)
*/
(function () {
  "use strict";

  var PHONE_DISPLAY = "07932 008040";
  var PHONE_TEL = "+447932008040";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ------------------------------------------------------------------
     1. Header, navigation, action bar, small bits
  ------------------------------------------------------------------ */
  var header = document.querySelector("[data-header]");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var navToggle = document.querySelector("[data-nav-toggle]");
  var nav = document.getElementById("site-nav");
  function setNav(open) {
    if (!navToggle || !nav) return;
    navToggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  }
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      setNav(navToggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNav(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setNav(false);
        navToggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) setNav(false);
    });
  }

  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Mobile action bar: shown once the hero buttons have scrolled away, hidden over the form
  var actionBar = document.querySelector("[data-action-bar]");
  var heroActions = document.querySelector("[data-hero-actions]");
  var quoteSection = document.getElementById("quote");
  if (actionBar && heroActions && quoteSection && "IntersectionObserver" in window) {
    var heroVisible = true, quoteVisible = false;
    var updateBar = function () {
      actionBar.classList.toggle("is-visible", !heroVisible && !quoteVisible);
    };
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting; updateBar();
    }).observe(heroActions);
    new IntersectionObserver(function (entries) {
      quoteVisible = entries[0].isIntersecting; updateBar();
    }, { threshold: 0.15 }).observe(quoteSection);
  }

  // The key's "Add to my quote" buttons and the form's service boxes stay in step
  var serviceBoxes = document.querySelectorAll('input[name="services"]');
  var keyButtons = document.querySelectorAll(".key-add[data-service]");
  function syncKey() {
    for (var i = 0; i < keyButtons.length; i++) {
      var on = false;
      for (var j = 0; j < serviceBoxes.length; j++) {
        if (serviceBoxes[j].value === keyButtons[i].getAttribute("data-service")) on = serviceBoxes[j].checked;
      }
      keyButtons[i].setAttribute("aria-pressed", String(on));
      keyButtons[i].querySelector(".key-add-label").textContent = on ? "On my quote" : "Add to my quote";
    }
  }
  for (var k = 0; k < keyButtons.length; k++) {
    keyButtons[k].addEventListener("click", function () {
      var value = this.getAttribute("data-service");
      for (var j = 0; j < serviceBoxes.length; j++) {
        if (serviceBoxes[j].value === value) serviceBoxes[j].checked = !serviceBoxes[j].checked;
      }
      clearError("services");
      syncKey();
    });
  }
  for (var s = 0; s < serviceBoxes.length; s++) serviceBoxes[s].addEventListener("change", syncKey);
  syncKey();

  /* ------------------------------------------------------------------
     2. Hero window
     The photo, the grime canvas and the squeegee layer share one 400 x 500
     coordinate space, so the canvas uses the same coordinates as the SVG.
  ------------------------------------------------------------------ */
  var windowEl = document.querySelector("[data-window]");
  if (windowEl) initWindow(windowEl);

  function initWindow(root) {
    var stage = root.querySelector(".window-stage");
    var canvas = root.querySelector("[data-grime]");
    var squeegee = root.querySelector("[data-squeegee]");
    var flip = root.querySelector("[data-squeegee-flip]");
    var gleam = root.querySelector("[data-gleam]");
    var captionText = root.querySelector("[data-caption-text]");
    var finishBtn = root.querySelector("[data-finish]");
    var dirtyBtn = root.querySelector("[data-dirty]");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var waterCanvas = root.querySelector("[data-water]");
    var wctx = waterCanvas && waterCanvas.getContext ? waterCanvas.getContext("2d") : null;
    var rinseFrame = 0;
    var VB_X = 0, VB_W = 400, VB_H = 500;
    var GLASS = "M0 0H400V500H0Z";
    var glassPath = typeof Path2D === "function" ? new Path2D(GLASS) : null;
    var BLADE = 44; // half the squeegee blade length
    var scale = 1;
    var state = "dirty"; // dirty -> (wiped by hand | animating) -> clean -> dirty again
    var grimeSeed = 7;
    var lastWipe = null;
    var lastCheck = 0;
    var CLEAN_ENOUGH = 0.9; // share of the glass wiped before we call it clean

    // Serpentine "fanning" passes over the whole window, like a real window cleaner.
    // x of 0 / 400 means "edge of the glass"; the squeegee itself is clamped inside the arch.
    var PASSES = [[0, 40], [400, 40], [400, 120], [0, 120], [0, 200], [400, 200], [400, 280], [0, 280], [0, 360], [400, 360],
      [400, 440], [0, 440], [0, 470], [400, 470]];

    squeegee.style.transition = "opacity .35s ease";

    function rng(seed) {
      return function () {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
    }

    function setup() {
      var rect = stage.getBoundingClientRect();
      if (!rect.width) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      if (waterCanvas) { waterCanvas.width = canvas.width; waterCanvas.height = canvas.height; }
      scale = canvas.width / VB_W;
      buildSamples();
      redraw();
    }

    function toView() {
      ctx.setTransform(scale, 0, 0, scale, -VB_X * scale, 0);
    }

    function paintGrime() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      toView();
      ctx.save();
      if (glassPath) ctx.clip(glassPath);

      var haze = ctx.createLinearGradient(0, 0, 0, 500);
      haze.addColorStop(0, "rgba(176, 166, 146, 0.76)");
      haze.addColorStop(0.55, "rgba(160, 147, 124, 0.8)");
      haze.addColorStop(1, "rgba(132, 117, 94, 0.88)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, 400, 500);

      var r = rng(grimeSeed);
      var i;
      // grit and dust
      for (i = 0; i < 2200; i++) {
        var x = r() * 400, y = r() * 500, rad = 0.4 + r() * 1.6;
        ctx.fillStyle = r() > 0.35
          ? "rgba(86, 72, 54," + (0.15 + r() * 0.4).toFixed(2) + ")"
          : "rgba(235, 229, 216," + (0.15 + r() * 0.3).toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
      // dried water spots
      ctx.lineWidth = 0.9;
      for (i = 0; i < 80; i++) {
        var sx = 10 + r() * 380, sy = 10 + r() * 480, sr = 2.5 + r() * 7;
        ctx.fillStyle = "rgba(118, 102, 80, 0.16)";
        ctx.strokeStyle = "rgba(244, 240, 232, 0.32)";
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // rain streaks
      ctx.lineCap = "round";
      for (i = 0; i < 30; i++) {
        var tx = 10 + r() * 380, ty = 10 + r() * 360, len = 40 + r() * 140;
        ctx.strokeStyle = "rgba(104, 88, 66, 0.22)";
        ctx.lineWidth = 1.5 + r() * 2.5;
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.bezierCurveTo(tx + (r() - 0.5) * 8, ty + len * 0.33, tx + (r() - 0.5) * 8, ty + len * 0.66, tx + (r() - 0.5) * 6, ty + len);
        ctx.stroke();
      }
      // grime gathers along the bottom edge of the pane
      [[430, 500]].forEach(function (band) {
        var g = ctx.createLinearGradient(0, band[0], 0, band[1]);
        g.addColorStop(0, "rgba(96, 80, 60, 0)");
        g.addColorStop(1, "rgba(96, 80, 60, 0.38)");
        ctx.fillStyle = g;
        ctx.fillRect(0, band[0], 400, band[1] - band[0]);
      });
      ctx.restore();
    }

    function eraseRect(x0, y0, x1, y1) {
      toView();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.globalCompositeOperation = "source-over";
    }

    function eraseStroke(a, b) {
      toView();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = BLADE * 2 - 12;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }

    // Erase the full band a set of passes covers, instantly
    function erasePasses(passes) {
      for (var i = 0; i < passes.length; i++) {
        var y = passes[i][1];
        eraseRect(0, y - BLADE, 400, y + BLADE);
      }
    }

    function redraw() {
      if (state === "clean") {
        canvas.style.opacity = "0";
        return;
      }
      paintGrime();
    }

    // Where the squeegee can sit at height y without poking outside the glass
    function glassSpan() {
      return [14, 386];
    }

    function placeSqueegee(x, y, dir) {
      var span = glassSpan(y);
      var cx = Math.min(Math.max(x, span[0]), span[1]);
      squeegee.setAttribute("transform", "translate(" + cx.toFixed(1) + " " + y.toFixed(1) + ")");
      flip.setAttribute("transform", dir < 0 ? "scale(-1 1)" : "");
    }

    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // Animate the squeegee along the passes, erasing as it goes
    function runPasses(passes, duration, done) {
      var segs = [], total = 0;
      for (var i = 1; i < passes.length; i++) {
        var a = passes[i - 1], b = passes[i];
        var len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
        segs.push({ a: a, b: b, len: len, start: total });
        total += len;
      }
      var dir = 1;
      var prev = { x: passes[0][0], y: passes[0][1] };
      placeSqueegee(prev.x, prev.y, dir);
      squeegee.style.opacity = "1";
      var t0 = null;

      function frame(now) {
        if (t0 === null) t0 = now;
        var p = Math.min((now - t0) / duration, 1);
        var dist = easeInOut(p) * total;
        var seg = segs[segs.length - 1];
        for (var j = 0; j < segs.length; j++) {
          if (dist <= segs[j].start + segs[j].len) { seg = segs[j]; break; }
        }
        var f = seg.len ? Math.min(Math.max((dist - seg.start) / seg.len, 0), 1) : 1;
        var x = seg.a[0] + (seg.b[0] - seg.a[0]) * f;
        var y = seg.a[1] + (seg.b[1] - seg.a[1]) * f;
        if (seg.b[0] !== seg.a[0]) dir = seg.b[0] > seg.a[0] ? 1 : -1;

        // Sweep the area between the previous and current blade positions
        if (Math.abs(y - prev.y) < 0.01) {
          eraseRect(prev.x, y - BLADE, x, y + BLADE);
        } else {
          eraseRect(x - 6, Math.min(prev.y, y) - BLADE, x + 6, Math.max(prev.y, y) + BLADE);
        }
        // catch any skipped segment ends so bands are always complete
        for (var k = 0; k < segs.length; k++) {
          if (segs[k].start + segs[k].len < dist && !segs[k].done) {
            segs[k].done = true;
            if (segs[k].a[1] === segs[k].b[1]) eraseRect(0, segs[k].a[1] - BLADE, 400, segs[k].a[1] + BLADE);
          }
        }
        prev = { x: x, y: y };
        placeSqueegee(x, y, dir);

        if (p < 1) {
          requestAnimationFrame(frame);
        } else {
          erasePasses(passes);
          squeegee.style.opacity = "0";
          if (done) done();
        }
      }
      requestAnimationFrame(frame);
    }

    function runGleam() {
      if (reduceMotion || !gleam) return;
      gleam.classList.remove("is-running");
      // restart the animation
      void gleam.getBoundingClientRect();
      gleam.classList.add("is-running");
    }

    // The rinse: pure water running down the clean glass and drying clear
    function rinse(done) {
      if (reduceMotion || !wctx) { if (done) done(); return; }
      cancelAnimationFrame(rinseFrame);
      var r = rng(Math.floor(Math.random() * 9973) + 1);
      var drops = [];
      for (var i = 0; i < 46; i++) {
        drops.push({
          x: 10 + r() * 380,
          y0: 10 + r() * 240,
          delay: r() * 420,
          speed: 0.18 + r() * 0.32,
          wob: (r() - 0.5) * 6,
          size: 2.2 + r() * 2.6
        });
      }
      var t0 = null, DURATION = 1900;
      function frame(now) {
        if (t0 === null) t0 = now;
        var t = now - t0;
        wctx.setTransform(1, 0, 0, 1, 0, 0);
        wctx.clearRect(0, 0, waterCanvas.width, waterCanvas.height);
        wctx.setTransform(scale, 0, 0, scale, -VB_X * scale, 0);
        wctx.save();
        if (glassPath) wctx.clip(glassPath);
        var fade = t > DURATION - 600 ? Math.max((DURATION - t) / 600, 0) : 1;
        // a light sheen of water over the whole pane, drying from the top
        var dry = Math.min(t / DURATION, 1);
        var sheen = wctx.createLinearGradient(0, 0, 0, 500);
        sheen.addColorStop(0, "rgba(220, 238, 250, 0)");
        sheen.addColorStop(Math.min(dry + 0.01, 1), "rgba(220, 238, 250, 0)");
        sheen.addColorStop(Math.min(dry + 0.2, 1), "rgba(200, 228, 248, " + (0.22 * fade).toFixed(3) + ")");
        sheen.addColorStop(1, "rgba(200, 228, 248, " + (0.28 * fade).toFixed(3) + ")");
        wctx.fillStyle = sheen;
        wctx.fillRect(0, 0, 400, 500);
        wctx.lineCap = "round";
        for (var i = 0; i < drops.length; i++) {
          var d = drops[i];
          var dt = t - d.delay;
          if (dt <= 0) continue;
          var y = d.y0 + d.speed * dt + 0.00018 * dt * dt;
          if (y > 496) y = 496;
          var x = d.x + Math.sin(dt / 140) * d.wob * 0.3;
          var top = Math.max(d.y0, y - 70);
          var trail = wctx.createLinearGradient(0, top, 0, y);
          trail.addColorStop(0, "rgba(255, 255, 255, 0)");
          trail.addColorStop(1, "rgba(255, 255, 255, " + (0.45 * fade).toFixed(3) + ")");
          wctx.strokeStyle = trail;
          wctx.lineWidth = d.size * 0.55;
          wctx.beginPath(); wctx.moveTo(d.x, top); wctx.lineTo(x, y); wctx.stroke();
          wctx.fillStyle = "rgba(255, 255, 255, " + (0.75 * fade).toFixed(3) + ")";
          wctx.beginPath(); wctx.arc(x, y, d.size, 0, Math.PI * 2); wctx.fill();
          wctx.fillStyle = "rgba(29, 111, 184, " + (0.25 * fade).toFixed(3) + ")";
          wctx.beginPath(); wctx.arc(x + d.size * 0.25, y + d.size * 0.3, d.size * 0.55, 0, Math.PI * 2); wctx.fill();
        }
        wctx.restore();
        if (t < DURATION) {
          rinseFrame = requestAnimationFrame(frame);
        } else {
          wctx.setTransform(1, 0, 0, 1, 0, 0);
          wctx.clearRect(0, 0, waterCanvas.width, waterCanvas.height);
          if (done) done();
        }
      }
      rinseFrame = requestAnimationFrame(frame);
    }

    function setCaption(text, button) {
      captionText.textContent = text;
      finishBtn.hidden = button !== "finish";
      dirtyBtn.hidden = button !== "dirty";
    }

    function toDirty() {
      state = "dirty";
      lastWipe = null;
      stage.classList.add("is-wipeable");
      setCaption(canHover
        ? "Run your cursor over the glass to clean it, or"
        : "Swipe across the glass to clean it, or", "finish");
      finishBtn.textContent = "let Andrew do it";
    }

    function toClean() {
      state = "clean";
      lastWipe = null;
      stage.classList.remove("is-wipeable");
      squeegee.style.opacity = "0";
      canvas.style.transition = reduceMotion ? "none" : "opacity .6s ease";
      canvas.style.opacity = "0";
      setCaption("That's how Andrew leaves your glass every time.", "dirty");
      rinse(runGleam);
    }

    // Let Andrew do it: squeegee the whole window, top to bottom
    function finish() {
      if (state !== "dirty") return;
      if (reduceMotion) { toClean(); return; }
      state = "animating";
      stage.classList.remove("is-wipeable");
      setCaption("Top to bottom, frames included.", null);
      runPasses(PASSES, 3600, toClean);
    }

    // Put fresh grime back on the glass so it can be cleaned again
    function makeDirty() {
      if (state !== "clean") return;
      cancelAnimationFrame(rinseFrame);
      if (wctx) { wctx.setTransform(1, 0, 0, 1, 0, 0); wctx.clearRect(0, 0, waterCanvas.width, waterCanvas.height); }
      grimeSeed = (grimeSeed * 31 + 17) % 9973; // a slightly different mess each time
      paintGrime();
      canvas.style.transition = reduceMotion ? "none" : "opacity .5s ease";
      canvas.style.opacity = "1";
      toDirty();
    }

    // Sample points spread over the glass (inside the arch), as canvas pixel offsets
    var samples = [];
    function buildSamples() {
      samples = [];
      for (var y = 10; y < 490; y += 8) {
        for (var x = 10; x < 390; x += 8) {
          var px = Math.round((x - VB_X) * scale), py = Math.round(y * scale);
          samples.push((py * canvas.width + px) * 4 + 3);
        }
      }
    }

    // Share of the glass that has been wiped by hand
    function glassCleared() {
      var data;
      try { data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; } catch (err) { return 0; }
      var clear = 0;
      for (var i = 0; i < samples.length; i++) {
        if (data[samples[i]] < 40) clear++;
      }
      return samples.length ? clear / samples.length : 0;
    }

    function viewPoint(e) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width * VB_W + VB_X,
        y: (e.clientY - rect.top) / rect.height * VB_H
      };
    }

    function wipe(e) {
      if (state !== "dirty") return;
      // a mouse wipes on hover; a finger wipes while it's down
      if (e.pointerType !== "mouse" && !e.buttons && e.type !== "pointerdown") return;
      var pt = viewPoint(e);
      pt.y = Math.min(Math.max(pt.y, 30), 470);
      var dir = lastWipe && pt.x < lastWipe.x ? -1 : 1;
      if (lastWipe) eraseStroke(lastWipe, pt);
      else eraseStroke(pt, pt);
      lastWipe = pt;
      placeSqueegee(pt.x, pt.y, dir);
      squeegee.style.opacity = "1";
      var now = performance.now();
      if (now - lastCheck > 200) {
        lastCheck = now;
        if (glassCleared() > CLEAN_ENOUGH) toClean();
      }
    }

    function endWipe() {
      lastWipe = null;
      if (state === "dirty") squeegee.style.opacity = "0";
    }

    canvas.addEventListener("pointermove", wipe);
    canvas.addEventListener("pointerdown", wipe);
    canvas.addEventListener("pointerleave", endWipe);
    canvas.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") endWipe(); });
    canvas.addEventListener("pointercancel", endWipe);
    finishBtn.addEventListener("click", finish);
    dirtyBtn.addEventListener("click", makeDirty);

    if ("ResizeObserver" in window) {
      var lastW = 0;
      new ResizeObserver(function (entries) {
        var w = entries[0].contentRect.width;
        if (Math.abs(w - lastW) < 1) return;
        lastW = w;
        if (state === "animating") return; // repaint at the end instead
        setup();
      }).observe(stage);
    }
    setup();
    toDirty();
  }

  /* ------------------------------------------------------------------
     3. Quote form
     Sends the same fields as the KAT enquiry workflow in n8n expects
     (Name, Email, PhoneNumber, Message, service, business, propertyType,
     frequency, houseNumber, postcode), which emails Andrew a formatted enquiry.
     The building number and street go together in houseNumber ("12 High Street"),
     so the email's Address line and map link show the full address; street is
     also sent on its own.
  ------------------------------------------------------------------ */
  var form = document.querySelector("[data-quote-form]");
  var successPanel = document.querySelector("[data-success]");
  var statusEl = document.querySelector("[data-form-status]");
  var submitBtn = document.querySelector("[data-submit]");
  var ENDPOINT = "https://foner.app.n8n.cloud/webhook/kat-contact-form-v2-9d41a7e3";
  // Preview copy: the form checks everything but sends nothing. Set to false when this goes live.
  var PREVIEW = /github\.io$|^localhost$|^127\./.test(location.hostname);
  var loadedAt = Date.now();

  // Postcode districts around Watton; anything else gets a gentle note, not a block
  var COVERED = ["IP24", "IP25", "PE37", "NR17", "NR9"];
  var POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function field(name) { return form ? form.elements[name] : null; }

  function showError(name, message) {
    var err = document.getElementById("f-" + name + "-error");
    var input = field(name);
    if (err) { err.textContent = message; err.hidden = false; }
    if (input && input.setAttribute) {
      input.setAttribute("aria-invalid", "true");
      if (err) input.setAttribute("aria-describedby", err.id);
    }
  }

  function clearError(name) {
    var err = document.getElementById("f-" + name + "-error");
    var input = field(name);
    if (err) err.hidden = true;
    if (input && input.removeAttribute) {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  }

  function formatPostcode(value) {
    var v = value.replace(/\s+/g, "").toUpperCase();
    return v.length > 3 ? v.slice(0, -3) + " " + v.slice(-3) : v;
  }

  function chosenServices() {
    return Array.prototype.map.call(form.querySelectorAll('input[name="services"]:checked'), function (b) { return b.value; });
  }

  function validate() {
    var firstBad = null;
    function bad(name, msg, focusEl) {
      showError(name, msg);
      if (!firstBad) firstBad = focusEl || field(name);
    }
    var phone = field("phone").value.trim();
    var email = field("email").value.trim();
    var postcode = field("postcode").value.trim();

    ["services", "name", "email", "phone", "property", "houseNumber", "street", "postcode", "message"].forEach(clearError);

    if (!chosenServices().length) bad("services", "Tick at least one thing you'd like cleaned.", form.querySelector('input[name="services"]'));
    if (!field("name").value.trim()) bad("name", "Enter your name.");
    if (!email) bad("email", "Enter your email so Andrew can reply.");
    else if (!EMAIL_RE.test(email)) bad("email", "Check the email address. It doesn't look quite right.");
    if (phone && phone.replace(/\D/g, "").length < 10) bad("phone", "Check the number. It looks a few digits short.");
    if (!field("property").value) bad("property", "Choose the type of property.");
    if (!field("houseNumber").value.trim()) bad("houseNumber", "Enter the building or house number or name.");
    if (!field("street").value.trim()) bad("street", "Enter the street name.");
    if (!postcode) bad("postcode", "Enter the postcode.");
    else if (!POSTCODE_RE.test(postcode)) bad("postcode", "Enter a full postcode, like IP25 6AB.");
    if (!field("message").value.trim()) bad("message", "Tell us a little about the job.");

    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  function showStatus(html) {
    statusEl.innerHTML = html;
    statusEl.hidden = false;
  }

  // "Request a commercial quote" buttons tick the matching service
  Array.prototype.forEach.call(document.querySelectorAll("[data-quote-service]"), function (a) {
    a.addEventListener("click", function () {
      var v = a.getAttribute("data-quote-service");
      Array.prototype.forEach.call(serviceBoxes, function (b) { if (b.value === v) b.checked = true; });
      syncKey();
    });
  });

  if (form) {
    ["name", "phone", "email", "property", "houseNumber", "street", "message"].forEach(function (n) {
      field(n).addEventListener("input", function () { clearError(n); });
    });
    form.addEventListener("change", function (e) {
      if (e.target.name === "services") clearError("services");
    });

    var postcodeInput = field("postcode");
    var postcodeHint = document.getElementById("f-postcode-hint");
    postcodeInput.addEventListener("input", function () { clearError("postcode"); });
    postcodeInput.addEventListener("blur", function () {
      var v = postcodeInput.value.trim();
      if (!v) { postcodeHint.hidden = true; return; }
      if (POSTCODE_RE.test(v)) {
        postcodeInput.value = formatPostcode(v);
        var district = postcodeInput.value.split(" ")[0];
        if (COVERED.indexOf(district) === -1) {
          postcodeHint.textContent = "That's outside our usual area, but send it anyway and we'll let you know.";
          postcodeHint.hidden = false;
        } else {
          postcodeHint.hidden = true;
        }
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      statusEl.hidden = true;
      if (!validate()) return;

      var name = field("name").value.trim();
      var data = new URLSearchParams();
      data.set("Name", name);
      data.set("Email", field("email").value.trim());
      data.set("PhoneNumber", field("phone").value.trim());
      data.set("Message", field("message").value.trim());
      data.set("service", chosenServices().join(", "));
      data.set("business", field("business").value.trim());
      data.set("propertyType", field("property").value);
      var freq = form.querySelector('input[name="frequency"]:checked');
      data.set("frequency", freq ? freq.value : "");
      var street = field("street").value.trim();
      data.set("houseNumber", [field("houseNumber").value.trim(), street].filter(Boolean).join(" "));
      data.set("street", street);
      data.set("postcode", formatPostcode(field("postcode").value.trim()));
      data.set("website", field("website").value);
      data.set("page", form.getAttribute("data-page") || "Website");
      data.set("t", String(Date.now() - loadedAt));

      if (PREVIEW) {
        showSuccess(name);
        document.querySelector("[data-success-body]").textContent =
          "Preview only: the form works, but nothing was sent because this version isn't live yet.";
        return;
      }

      submitBtn.setAttribute("aria-busy", "true");
      submitBtn.querySelector(".btn-label").textContent = "Sending";

      var controller = "AbortController" in window ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;

      fetch(ENDPOINT, { method: "POST", body: data, signal: controller ? controller.signal : undefined })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            if (res.ok && json.ok !== false) { showSuccess(name); return; }
            throw new Error((json && json.error) || "Send failed");
          });
        })
        .catch(function (err) {
          var msg = err && err.message && err.message !== "Send failed" && !/abort|fetch/i.test(err.message) ? err.message + " " : "Your request didn't send. ";
          showStatus(msg + "Try again, or call <a href=\"tel:" + PHONE_TEL + "\">" + PHONE_DISPLAY + "</a>.");
        })
        .then(function () {
          if (timer) clearTimeout(timer);
          submitBtn.removeAttribute("aria-busy");
          submitBtn.querySelector(".btn-label").textContent = "Send my quote request";
        });
    });
  }

  /* ------------------------------------------------------------------
     4. "Is your site in our area?" postcode check in the hero
  ------------------------------------------------------------------ */
  var check = document.querySelector("[data-check]");
  if (check) {
    var checkInput = check.elements.postcode;
    var checkResult = check.querySelector("[data-check-result]");
    var QUOTE_LINK = '<a href="#quote" data-to-quote>Get my free quote</a>';
    check.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = checkInput.value.trim();
      checkInput.removeAttribute("aria-invalid");
      if (!v) {
        checkResult.innerHTML = '<span class="bad">Type your postcode, like IP25 6AB.</span>';
        checkInput.setAttribute("aria-invalid", "true");
        checkInput.focus();
        return;
      }
      // A district alone (e.g. "IP25") is enough to answer
      var district = v.replace(/\s+/g, "").toUpperCase();
      if (POSTCODE_RE.test(v)) {
        checkInput.value = formatPostcode(v);
        district = checkInput.value.split(" ")[0];
      } else if (!/^[A-Z]{1,2}\d[A-Z\d]?$/.test(district)) {
        checkResult.innerHTML = '<span class="bad">That doesn’t look like a postcode. Try something like IP25 6AB.</span>';
        checkInput.setAttribute("aria-invalid", "true");
        checkInput.focus();
        return;
      }
      if (COVERED.indexOf(district) !== -1) {
        checkResult.innerHTML = '<span class="yes">Yes, ' + district + ' is in our area.</span> ' + QUOTE_LINK;
        presentForm(district);
      } else {
        checkResult.innerHTML = '<span class="near">' + district + ' is outside our usual area.</span> Ask anyway and we’ll let you know. ' + QUOTE_LINK;
      }
    });
    checkInput.addEventListener("input", function () { checkInput.removeAttribute("aria-invalid"); });

    // In the area: take them straight to the quote form, postcode filled in and a note at the top
    function presentForm(district) {
      if (!form) return;
      var pc = checkInput.value.trim();
      if (pc && POSTCODE_RE.test(pc)) { field("postcode").value = formatPostcode(pc); clearError("postcode"); }
      var note = form.querySelector("[data-area-ok]");
      if (note) {
        note.textContent = "Good news: " + district + " is in our area. Fill in the details below and Andrew will get back to you with a price.";
        note.hidden = false;
      }
      var card = document.querySelector(".quote-card");
      if (!card) return;
      setTimeout(function () {
        card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        card.focus({ preventScroll: true });
      }, 700);
    }

    // Carry the postcode down to the quote form
    checkResult.addEventListener("click", function (e) {
      if (!e.target.closest("[data-to-quote]") || !form) return;
      var pc = checkInput.value.trim();
      if (pc && POSTCODE_RE.test(pc)) {
        field("postcode").value = formatPostcode(pc);
        clearError("postcode");
      }
    });
  }

  /* ------------------------------------------------------------------
     5. Gazetteer: choose a place to light it up on the map
  ------------------------------------------------------------------ */
  var mapSvg = document.querySelector(".area-map-svg");
  var placeButtons = document.querySelectorAll(".gaz-place");
  if (mapSvg && placeButtons.length) {
    var selectPlace = function (name) {
      for (var i = 0; i < placeButtons.length; i++) {
        placeButtons[i].setAttribute("aria-pressed", String(placeButtons[i].getAttribute("data-place") === name));
      }
      var towns = mapSvg.querySelectorAll("[data-town]");
      for (var j = 0; j < towns.length; j++) {
        towns[j].classList.toggle("is-selected", towns[j].getAttribute("data-town") === name);
      }
      mapSvg.classList.toggle("has-selection", !!name);
    };
    for (var p = 0; p < placeButtons.length; p++) {
      placeButtons[p].addEventListener("click", function () {
        var name = this.getAttribute("data-place");
        selectPlace(this.getAttribute("aria-pressed") === "true" ? null : name);
      });
    }
  }

  function showSuccess(name, phone) {
    var first = (name || "").trim().split(/\s+/)[0];
    document.querySelector("[data-success-title]").textContent =
      first ? "Thanks, " + first + ". Your request is in." : "Thanks. Your request is in.";
    document.querySelector("[data-success-body]").textContent =
      phone ? "Andrew will get back to you on " + phone + " with a price." : "Andrew will be in touch soon with a price.";
    form.hidden = true;
    successPanel.hidden = false;
    successPanel.focus();
  }

  var resetBtn = document.querySelector("[data-reset]");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      form.reset();
      syncKey();
      document.getElementById("f-postcode-hint").hidden = true;
      statusEl.hidden = true;
      successPanel.hidden = true;
      form.hidden = false;
      field("name").focus();
    });
  }

  /* ------------------------------------------------------------------
     6. Before and after slider (gutters page)
  ------------------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll("[data-ba]"), function (box) {
    var range = box.querySelector(".ba-range");
    if (!range) return;
    var update = function () { box.style.setProperty("--pos", range.value + "%"); };
    range.addEventListener("input", update);
    update();
  });

  /* ------------------------------------------------------------------
     7. Reviews page: filter by what the review mentions
  ------------------------------------------------------------------ */
  var wall = document.querySelector("[data-review-wall]");
  if (wall) {
    var chips = document.querySelectorAll("[data-filter]");
    var cards = wall.querySelectorAll(".review-card");
    var countEl = document.querySelector("[data-reviews-count]");
    var allText = countEl ? countEl.innerHTML : "";
    function pack() {
      wall.classList.add("is-masonry");
      Array.prototype.forEach.call(cards, function (card) {
        if (card.hidden) return;
        card.style.gridRowEnd = "auto";
        card.style.gridRowEnd = "span " + Math.ceil((card.getBoundingClientRect().height + 20) / 4);
      });
    }
    var packTimer;
    function packSoon() { clearTimeout(packTimer); packTimer = setTimeout(pack, 80); }
    pack();
    window.addEventListener("resize", packSoon);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pack);
    wall.addEventListener("toggle", packSoon, true);
    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener("click", function () {
        var f = chip.getAttribute("data-filter"), shown = 0;
        Array.prototype.forEach.call(chips, function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        Array.prototype.forEach.call(cards, function (card) {
          var on = f === "all" || (" " + card.getAttribute("data-tags") + " ").indexOf(" " + f + " ") !== -1;
          card.hidden = !on; if (on) shown++;
        });
        pack();
        if (countEl) countEl.innerHTML = f === "all" ? allText : "Showing " + shown + " reviews that mention " + chip.firstChild.textContent.trim().toLowerCase() + ".";
      });
    });
  }
})();
