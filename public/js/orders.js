// Shared order-card markup (also used by the dashboard), then the "My orders" page.
(function () {
  'use strict';
  var IC = window.IC;

  IC.orderCard = function (o, showCustomer) {
    var date = new Date(o.createdAt).toLocaleString();
    var items = o.items.map(function (i) {
      return '<tr><td>' + IC.escapeHtml(i.name) + '</td><td class="text-center">' + i.quantity + '</td>' +
        '<td class="text-right">' + IC.money(i.unitPrice) + '</td><td class="text-right">' + IC.money(i.unitPrice * i.quantity) + '</td></tr>';
    }).join('');
    return '<div class="panel panel-default order-card">' +
      '<div class="panel-heading"><strong>Order #' + o.id + '</strong> &middot; ' + IC.escapeHtml(date) +
        (showCustomer ? ' &middot; ' + IC.escapeHtml(o.customer.name) + ' (<a href="mailto:' + IC.escapeHtml(o.customer.email) + '">' + IC.escapeHtml(o.customer.email) + '</a>)' : '') +
        '<span class="pull-right"><strong>' + IC.money(o.total) + '</strong></span></div>' +
      '<table class="table table-condensed"><thead><tr><th>Item</th><th class="text-center">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr></thead>' +
      '<tbody>' + items + '</tbody></table></div>';
  };

  var list = document.getElementById('orders-list');
  if (!list) return; // loaded on the dashboard only for IC.orderCard

  IC.api('/api/orders').then(function (orders) {
    document.getElementById('orders-empty').hidden = orders.length > 0;
    list.innerHTML = orders.map(function (o) { return IC.orderCard(o, false); }).join('');
  }).catch(function (err) {
    if (err.status === 401) { location.href = '/login?next=' + encodeURIComponent('/orders'); return; }
    IC.showAlert(document.getElementById('orders-alert'), 'danger', err.message);
  });
})();
