/* KAT Window Cleaning - contact form
   Sends the form to the n8n workflow in the background and shows the
   result on the page, so visitors never leave the site. */
(function () {
  var ENDPOINT = 'https://foner.app.n8n.cloud/webhook/kat-contact-form-5b8e2c71';
  var FALLBACK = 'Sorry, your message could not be sent. Please call 07932 008040 or email info@katwindowcleaning.com.';
  var loadedAt = Date.now();

  function showStatus(box, text, ok) {
    box.textContent = text;
    box.style.display = 'block';
    box.style.background = ok ? '#bae3e8' : '#fde2e1';
    box.style.color = ok ? '#25323f' : '#7a1c16';
  }

  var forms = document.querySelectorAll('form.kat-contact-form');
  Array.prototype.forEach.call(forms, function (form) {
    var button = form.querySelector('button[type="submit"]');
    var box = form.querySelector('.form-status');

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
      button.textContent = 'SENDING...';
      box.style.display = 'none';

      fetch(ENDPOINT, { method: 'POST', body: data })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            return { ok: res.ok && json.ok !== false, json: json };
          });
        })
        .then(function (result) {
          if (result.ok) {
            form.reset();
            showStatus(box, 'Thank you! Your message has been sent and we will be in touch soon.', true);
            button.textContent = 'SENT';
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
})();
