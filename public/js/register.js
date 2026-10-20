// Registration form. The browser only collects and checks the data;
// the server (POST /api/register) hashes the password and saves the user in MySQL.
(function () {
  'use strict';
  var IC = window.IC;
  var form = document.getElementById('RegForm');
  var alertBox = document.getElementById('reg-alert');

  var ownerGroup = document.getElementById('owner-code-group');
  form.elements.Typeselection.addEventListener('change', function () {
    ownerGroup.hidden = this.value !== 'Business Owner';
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    var data = {
      firstname: f.Firstname.value.trim(),
      lastname: f.Lastname.value.trim(),
      email: f.email.value.trim(),
      gender: f.optradio.value || null,
      userType: f.Typeselection.value,
      password: f.pwd1.value,
      confirmPassword: f.pwd2.value,
      ownerCode: f.ownerCode.value
    };

    var errors = [];
    if (!data.firstname) errors.push('First name is required.');
    if (!data.lastname) errors.push('Last name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Enter a valid email address.');
    if (data.userType === 'Business Owner' && !data.ownerCode) errors.push('Enter the business access code.');
    if (data.password.length < 8) errors.push('Password must be at least 8 characters.');
    if (data.password !== data.confirmPassword) errors.push('Passwords do not match.');
    if (errors.length) return IC.showAlert(alertBox, 'danger', errors.join(' '));

    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    IC.api('/api/register', { method: 'POST', body: data })
      .then(function (res) {
        IC.showAlert(alertBox, 'success', 'Welcome, ' + res.user.firstname + '! Your account has been created.');
        setTimeout(function () { location.href = '/'; }, 1200);
      })
      .catch(function (err) {
        IC.showAlert(alertBox, 'danger', err.message);
        btn.disabled = false;
      });
  });
})();
