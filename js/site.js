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
})();
