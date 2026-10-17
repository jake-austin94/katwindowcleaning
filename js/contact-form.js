/* KAT Window Cleaning - contact forms
   Sends forms in the background to the n8n workflow and shows the result
   on the page. Also shows the extra business questions when someone picks
   "Commercial" in the service list. */
(function () {
  var ENDPOINT = 'https://foner.app.n8n.cloud/webhook/kat-contact-form-v2-9d41a7e3';
  var FALLBACK = 'Sorry, your message could not be sent. Please call 07932 008040 or email info@katwindowcleaning.com.';
  var loadedAt = Date.now();

  function showStatus(box, text, ok) {
    box.textContent = text;
    box.hidden = false;
    box.className = 'form-status ' + (ok ? 'is-ok' : 'is-error');
  }

  function toggleBusiness(form) {
    var select = form.querySelector('[name="service"]');
    var extra = form.querySelector('[data-commercial-fields]');
    if (!select || !extra) return;
    var on = /commercial/i.test(select.value);
    extra.hidden = !on;
    Array.prototype.forEach.call(extra.querySelectorAll('[data-required-when-commercial]'), function (el) {
      el.required = on;
    });
  }

  var forms = document.querySelectorAll('form.kat-contact-form');
  Array.prototype.forEach.call(forms, function (form) {
    var button = form.querySelector('button[type="submit"]');
    var box = form.querySelector('.form-status');
    var select = form.querySelector('[name="service"]');

    var preset = new URLSearchParams(location.search).get('service');
    if (select && preset) {
      Array.prototype.forEach.call(select.options, function (o) { if (o.value === preset) select.value = preset; });
    }
    if (select) { select.addEventListener('change', function () { toggleBusiness(form); }); toggleBusiness(form); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.checkValidity && !form.checkValidity()) {
        if (form.reportValidity) form.reportValidity();
        return;
      }
      var data = new URLSearchParams(new FormData(form));
      data.set('page', form.getAttribute('data-page') || document.title);
      data.set('t', String(Date.now() - loadedAt));

      var label = button.textContent;
      button.disabled = true;
      button.textContent = 'Sending...';
      box.hidden = true;

      fetch(ENDPOINT, { method: 'POST', body: data })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            return { ok: res.ok && json.ok !== false, json: json };
          });
        })
        .then(function (result) {
          if (result.ok) {
            form.reset();
            toggleBusiness(form);
            showStatus(box, 'Thank you! Your message has been sent and Andrew will be in touch soon.', true);
            button.textContent = 'Sent';
          } else {
            showStatus(box, (result.json && result.json.error) || FALLBACK, false);
            button.disabled = false;
            button.textContent = label;
          }
        })
        .catch(function () {
          showStatus(box, FALLBACK, false);
          button.disabled = false;
          button.textContent = label;
        });
    });
  });

  /* Footer year always shows the current year */
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
