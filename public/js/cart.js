(function () {
  'use strict';
  var IC = window.IC;
  var alertBox = document.getElementById('cart-alert');
  var rows = document.getElementById('cart-rows');

  function render(cart) {
    IC.setCartCount(cart.count);
    document.getElementById('cart-empty').hidden = cart.items.length > 0;
    document.getElementById('cart-content').hidden = cart.items.length === 0;
    document.getElementById('cart-total').textContent = IC.money(cart.total);
    rows.innerHTML = cart.items.map(function (i) {
      return '<tr data-id="' + i.id + '">' +
        '<td><span class="cart-thumb">' + IC.productImage(i) + '</span><strong>' + IC.escapeHtml(i.name) + '</strong><br><small class="text-muted">' + IC.escapeHtml(i.category || '') + '</small></td>' +
        '<td>' + IC.priceHtml(i) + '</td>' +
        '<td><label class="sr-only" for="qty-' + i.id + '">Quantity</label>' +
          '<input type="number" min="0" max="' + i.stock + '" value="' + i.quantity + '" class="form-control qty-input" id="qty-' + i.id + '"></td>' +
        '<td class="text-right">' + IC.money(i.lineTotal) + '</td>' +
        '<td class="text-right"><button type="button" class="btn btn-link remove-btn" aria-label="Remove ' + IC.escapeHtml(i.name) + '">' +
          '<span class="glyphicon glyphicon-trash"></span></button></td>' +
      '</tr>';
    }).join('');
  }

  function fail(err) { IC.showAlert(alertBox, 'danger', err.message); }

  function load() { return IC.api('/api/cart').then(render).catch(fail); }

  rows.addEventListener('change', function (e) {
    if (!e.target.classList.contains('qty-input')) return;
    var id = e.target.closest('tr').getAttribute('data-id');
    alertBox.hidden = true;
    IC.api('/api/cart/' + id, { method: 'PUT', body: { quantity: e.target.value } })
      .then(render)
      .catch(function (err) { fail(err); load(); });
  });

  rows.addEventListener('click', function (e) {
    var btn = e.target.closest('.remove-btn');
    if (!btn) return;
    var id = btn.closest('tr').getAttribute('data-id');
    IC.api('/api/cart/' + id, { method: 'DELETE' }).then(render).catch(fail);
  });

  document.getElementById('checkout-btn').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    IC.api('/api/checkout', { method: 'POST' })
      .then(function (order) {
        render({ items: [], total: 0, count: 0 });
        document.getElementById('cart-empty').hidden = true;
        IC.showAlert(alertBox, 'success', 'Thank you! Order #' + order.orderId + ' for ' + IC.money(order.total) + ' has been placed.');
      })
      .catch(function (err) {
        if (err.status === 401) {
          location.href = '/login?next=' + encodeURIComponent('/cart');
          return;
        }
        fail(err);
      })
      .then(function () { btn.disabled = false; });
  });

  load();
})();
