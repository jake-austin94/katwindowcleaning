/* KAT Window Cleaning - small site behaviours: mobile menu and the
   gutter before/after comparison. */
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Close' : 'Menu';
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-ba]'), function (box) {
    var range = box.querySelector('.ba-range');
    if (!range) return;
    var update = function () { box.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', update);
    update();
  });

  /* Gentle fade-up as sections scroll into view (only when <html data-fade="on">). Skipped for anyone whose device asks for
     reduced motion, and nothing is hidden until this script has run, so if it ever fails
     the page simply shows everything as normal. Never used on the top-of-page hero. */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fadeOn = document.documentElement.getAttribute('data-fade') === 'on';
  if (fadeOn && !reduce && 'IntersectionObserver' in window) {
    var picks = [
      'main section:not(.hero):not(.page-hero):not(.proof) h2',
      '.service-row', '.season-inner', '.band-grid img', '.band-grid .ticks li',
      '.review', '.about-grid img', '.town-list li', '.step-list li', '.who-list li',
      '.included .ticks li', '.why .ticks li', '.compare .ticks li', '.split > picture > img', '.ba', '.season-card',
      '.faq details', '.call-card', '.form'
    ].join(',');
    var els = Array.prototype.slice.call(document.querySelectorAll(picks));
    var groups = new Map();
    els.forEach(function (el) {
      var key = el.parentElement; var n = groups.get(key) || 0; groups.set(key, n + 1);
      el.setAttribute('data-reveal', '');
      el.style.setProperty('--rd', Math.min(n, 5) * 70 + 'ms');
      /* anything already on screen when the page opens is shown straight away */
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
    });
    document.documentElement.classList.add('reveal-on');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(function (el) { if (!el.classList.contains('is-in')) io.observe(el); });
  }
})();
