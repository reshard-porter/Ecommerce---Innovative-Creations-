(function () {
  'use strict';
  var IC = window.IC;
  var form = document.getElementById('login-form');
  var alertBox = document.getElementById('login-alert');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    if (!f.email.value || !f.password.value) {
      return IC.showAlert(alertBox, 'danger', 'Please enter your email and password.');
    }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    IC.api('/api/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } })
      .then(function () {
        // Go back to where the user came from (e.g. the cart), only within this site.
        var next = new URLSearchParams(location.search).get('next');
        location.href = next && next.charAt(0) === '/' && next.charAt(1) !== '/' ? next : '/';
      })
      .catch(function (err) {
        IC.showAlert(alertBox, 'danger', err.message);
        btn.disabled = false;
      });
  });
})();
