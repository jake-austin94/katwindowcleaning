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

  /* The chosen services, from tick-boxes (name="services") or a single list */
  function chosenServices(form) {
    var boxes = form.querySelectorAll('input[name="services"]');
    if (boxes.length) {
      return Array.prototype.filter.call(boxes, function (b) { return b.checked; }).map(function (b) { return b.value; });
    }
    var select = form.querySelector('[name="service"]');
    return select && select.value ? [select.value] : [];
  }

  function toggleBusiness(form) {
    var extra = form.querySelector('[data-commercial-fields]');
    if (!extra) return;
    var on = chosenServices(form).some(function (s) { return /commercial/i.test(s); });
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
    var boxes = form.querySelectorAll('input[name="services"]');
    var servicesError = form.querySelector('[data-services-error]');

    /* A link such as contact.html?service=Gutter%20clearance pre-selects that service */
    var preset = new URLSearchParams(location.search).get('service');
    if (preset) {
      if (select) Array.prototype.forEach.call(select.options, function (o) { if (o.value === preset) select.value = preset; });
      Array.prototype.forEach.call(boxes, function (b) { if (b.value === preset) b.checked = true; });
    }
    if (select) select.addEventListener('change', function () { toggleBusiness(form); });
    /* At least one service must be ticked; the browser shows the message */
    function syncServiceValidity() {
      if (!boxes.length) return;
      boxes[0].setCustomValidity(chosenServices(form).length ? '' : 'Please tick at least one service.');
      if (servicesError && chosenServices(form).length) servicesError.hidden = true;
    }
    Array.prototype.forEach.call(boxes, function (b) {
      b.addEventListener('change', function () { toggleBusiness(form); syncServiceValidity(); });
    });
    toggleBusiness(form);
    syncServiceValidity();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (boxes.length && !chosenServices(form).length) {
        if (servicesError) servicesError.hidden = false;
        boxes[0].focus();
        return;
      }
      if (form.checkValidity && !form.checkValidity()) {
        if (form.reportValidity) form.reportValidity();
        return;
      }
      var data = new URLSearchParams(new FormData(form));
      data.delete('services');
      data.set('service', chosenServices(form).join(', '));
      var pc = form.querySelector('[name="postcode"]');
      if (pc) data.set('postcode', pc.value.trim().toUpperCase());
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
            syncServiceValidity();
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
