/* =========================================================
   Shared website analytics
   Used by T M Professional Window Cleaning, KAT Window Cleaning
   and The Roof & Render Cleaning Company. The only line that
   changes between sites is SITE below.

   No cookies, no localStorage for tracking, no fingerprinting.
   A visitor is a salted daily hash of IP + browser, worked out
   on the server and never stored in a way that can be reversed,
   so no consent banner is needed for this part.
   ========================================================= */
(function () {
  "use strict";

  var SITE = "kat-window-cleaning";
  var ENDPOINT = "https://lkfriflskqyvwaknzbet.supabase.co/functions/v1/track";

  /* Optional extras (ad pixels, Google Analytics and so on).
     Leave empty and no cookie banner appears, because nothing on the
     site needs consent. Add an entry and the banner switches itself on.
     Each extra: { name, load: function () { ...inject the script... } } */
  var EXTRAS = [];

  var CONSENT_KEY = "kat_consent";
  var started = Date.now();
  var sent = false;

  /* ---------- helpers ---------- */

  function param(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || null;
    } catch (e) {
      return null;
    }
  }

  function send(payload, beacon) {
    payload.site = SITE;
    payload.path = window.location.pathname || "/";
    var body = JSON.stringify(payload);
    try {
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
        return;
      }
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true
      })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.visit_ref) window.__visitRef = j.visit_ref; })
        .catch(function () {});
    } catch (e) {}
  }

  /* ---------- page view ---------- */

  function pageview() {
    send({
      type: "pageview",
      title: document.title,
      referrer: document.referrer || null,
      utm_source: param("utm_source"),
      utm_medium: param("utm_medium"),
      utm_campaign: param("utm_campaign"),
      utm_content: param("utm_content"),
      utm_term: param("utm_term")
    });
  }

  /* ---------- named actions ---------- */

  function track(name, detail) {
    send({ type: "event", name: name, detail: detail || null });
  }

  /* Time on page, sent once when the visitor leaves. */
  function sendDuration() {
    if (sent) return;
    sent = true;
    var seconds = Math.round((Date.now() - started) / 1000);
    if (seconds < 2) return;
    send({ type: "pageview", title: document.title, seconds: seconds }, true);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") sendDuration();
  });
  window.addEventListener("pagehide", sendDuration);

  /* Clicks that matter: phone, WhatsApp, email. */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.indexOf("tel:") === 0) track("call_click", href.slice(4));
    else if (href.indexOf("mailto:") === 0) track("email_click", href.slice(7).split("?")[0]);
    else if (href.indexOf("wa.me") !== -1) track("whatsapp_click", null);
  }, true);

  /* ---------- cookie banner, for optional extras only ---------- */

  function consentChoice() {
    try { return window.localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  function saveChoice(v) {
    try { window.localStorage.setItem(CONSENT_KEY, v); } catch (e) {}
  }
  function loadExtras() {
    EXTRAS.forEach(function (x) {
      try { x.load(); } catch (e) {}
    });
  }

  function banner() {
    if (!EXTRAS.length) return;            // nothing needs consent
    var choice = consentChoice();
    if (choice === "all") { loadExtras(); return; }
    if (choice === "essential") return;

    var el = document.createElement("div");
    el.className = "cookie-banner";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Cookies");
    el.innerHTML =
      '<p>We count visits in a way that uses no cookies. We would also like to use ' +
      'optional cookies to measure our advertising. You can say no and the site works just the same. ' +
      '<a href="/privacy.html">Privacy</a></p>' +
      '<div class="cookie-actions">' +
      '<button type="button" data-cookie="essential" class="btn btn-sm cookie-quiet">Essential only</button>' +
      '<button type="button" data-cookie="all" class="btn btn-ink btn-sm">Accept all</button>' +
      "</div>";
    document.body.appendChild(el);

    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cookie]");
      if (!b) return;
      var v = b.getAttribute("data-cookie");
      saveChoice(v);
      if (v === "all") loadExtras();
      el.remove();
      track("cookie_choice", v);
    });
  }

  /* ---------- go ---------- */

  pageview();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", banner);
  } else {
    banner();
  }

  window.katTrack = track;
  window.tmTrack = track;
  window.katConvert = window.tmConvert = function () { send({ type: "enquiry" }); };
})();
