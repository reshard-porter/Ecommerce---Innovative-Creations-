// Business Owner dashboard: summary, products (add / edit / delete), orders, messages.
(function () {
  'use strict';
  var IC = window.IC;
  var alertBox = document.getElementById('dash-alert');
  var products = [];

  function fail(err) { IC.showAlert(alertBox, 'danger', err.message); }

  // ---------- Access check ----------
  IC.me.then(function (data) {
    if (!data.user) { location.href = '/login?next=' + encodeURIComponent('/dashboard'); return; }
    if (data.user.userType !== 'Business Owner') {
      IC.showAlert(alertBox, 'warning', 'The dashboard is only for Business Owner accounts.');
      return;
    }
    document.getElementById('dash-content').hidden = false;
    loadSummary();
    loadProducts();
    loadOrders();
    loadMessages();
  }).catch(fail);

  // ---------- Summary ----------
  function stat(label, value) {
    return '<div class="col-xs-6 col-sm-4 col-md-2"><div class="stat"><span>' + label + '</span><strong>' + value + '</strong></div></div>';
  }
  function loadSummary() {
    IC.api('/api/admin/summary').then(function (s) {
      document.getElementById('stats').innerHTML =
        stat('Revenue', IC.money(s.revenue)) + stat('Orders', s.orders) + stat('Customers', s.customers) +
        stat('Products', s.products) + stat('Out of stock', s.outOfStock) + stat('Messages', s.messages);
    }).catch(fail);
  }

  // ---------- Products ----------
  function loadProducts() {
    products = [];
    (function page(offset) {
      IC.api('/api/products?limit=50&offset=' + offset).then(function (data) {
        products = products.concat(data.products);
        if (products.length < data.total && data.products.length) return page(products.length);
        renderProducts();
      }).catch(fail);
    })(0);
    IC.api('/api/categories?all=1').then(function (cats) {
      document.getElementById('category-options').innerHTML = cats.map(function (c) {
        return '<option value="' + IC.escapeHtml(c.name) + '">';
      }).join('');
    });
  }

  var filterInput = document.getElementById('product-filter');
  filterInput.addEventListener('input', renderProducts);

  function renderProducts() {
    var term = filterInput.value.trim().toLowerCase();
    var shown = products.filter(function (p) {
      return !term || (p.name + ' ' + (p.category || '')).toLowerCase().indexOf(term) !== -1;
    });
    document.getElementById('product-count').textContent = shown.length + ' of ' + products.length + ' products';
    document.getElementById('product-rows').innerHTML = shown.map(function (p) {
      return '<tr data-id="' + p.id + '">' +
        '<td><span class="cart-thumb">' + IC.productImage(p) + '</span><strong>' + IC.escapeHtml(p.name) + '</strong></td>' +
        '<td>' + IC.escapeHtml(p.category || '-') + '</td>' +
        '<td>' + IC.priceHtml(p) + '</td>' +
        '<td>' + (p.stock > 0 ? p.stock : '<span class="label label-danger">Out of stock</span>') + '</td>' +
        '<td class="text-right text-nowrap">' +
          '<button type="button" class="btn btn-default btn-sm edit-btn"><span class="glyphicon glyphicon-pencil"></span> Edit</button> ' +
          '<button type="button" class="btn btn-default btn-sm delete-btn" aria-label="Delete ' + IC.escapeHtml(p.name) + '"><span class="glyphicon glyphicon-trash"></span></button>' +
        '</td></tr>';
    }).join('');
  }

  var form = document.getElementById('product-form');
  var formAlert = document.getElementById('product-form-alert');
  var preview = document.getElementById('pf-preview');

  function updatePreview() {
    var url = form.elements.imageUrl.value.trim();
    preview.innerHTML = url ? IC.productImage({ imageUrl: url, name: 'Preview' }) : '';
  }
  form.elements.imageUrl.addEventListener('input', updatePreview);

  function openForm(p) {
    form.reset();
    formAlert.hidden = true;
    var f = form.elements;
    f.id.value = p ? p.id : '';
    f.name.value = p ? p.name : '';
    f.category.value = p ? (p.category || '') : '';
    f.description.value = p ? (p.description || '') : '';
    f.price.value = p ? p.price : '';
    f.salePrice.value = p && p.salePrice != null ? p.salePrice : '';
    f.stock.value = p ? p.stock : 0;
    f.imageUrl.value = p ? (p.imageUrl || '') : '';
    document.getElementById('product-form-title').textContent = p ? 'Edit product' : 'Add product';
    updatePreview();
    $('#product-form-modal').modal('show');
  }

  document.getElementById('add-product-btn').addEventListener('click', function () { openForm(null); });

  document.getElementById('product-rows').addEventListener('click', function (e) {
    var row = e.target.closest('tr');
    if (!row) return;
    var id = Number(row.getAttribute('data-id'));
    var p = products.filter(function (x) { return x.id === id; })[0];
    if (e.target.closest('.edit-btn')) openForm(p);
    if (e.target.closest('.delete-btn')) {
      if (!confirm('Delete "' + p.name + '"? This cannot be undone.')) return;
      IC.api('/api/products/' + id, { method: 'DELETE' }).then(function () {
        IC.showAlert(alertBox, 'success', '"' + p.name + '" was deleted.');
        loadProducts();
        loadSummary();
      }).catch(fail);
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements;
    var body = {
      name: f.name.value, category: f.category.value, description: f.description.value,
      price: f.price.value, salePrice: f.salePrice.value, stock: f.stock.value, imageUrl: f.imageUrl.value
    };
    var id = f.id.value;
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    IC.api(id ? '/api/products/' + id : '/api/products', { method: id ? 'PUT' : 'POST', body: body })
      .then(function (p) {
        $('#product-form-modal').modal('hide');
        IC.showAlert(alertBox, 'success', '"' + p.name + '" was ' + (id ? 'updated.' : 'added.'));
        loadProducts();
        loadSummary();
      })
      .catch(function (err) { IC.showAlert(formAlert, 'danger', err.message); })
      .then(function () { btn.disabled = false; });
  });

  // ---------- Orders ----------
  function loadOrders() {
    IC.api('/api/admin/orders').then(function (orders) {
      document.getElementById('admin-orders-empty').hidden = orders.length > 0;
      document.getElementById('admin-orders').innerHTML = orders.map(function (o) { return IC.orderCard(o, true); }).join('');
    }).catch(fail);
  }

  // ---------- Messages ----------
  function loadMessages() {
    IC.api('/api/admin/messages').then(function (msgs) {
      document.getElementById('messages-empty').hidden = msgs.length > 0;
      document.getElementById('messages').innerHTML = msgs.map(function (m) {
        return '<div class="panel panel-default" data-id="' + m.id + '"><div class="panel-heading">' +
          '<strong>' + IC.escapeHtml(m.name) + '</strong> &middot; <a href="mailto:' + IC.escapeHtml(m.email) + '">' + IC.escapeHtml(m.email) + '</a>' +
          ' &middot; <small>' + IC.escapeHtml(new Date(m.createdAt).toLocaleString()) + '</small>' +
          '<button type="button" class="btn btn-link btn-xs pull-right delete-msg" aria-label="Delete message"><span class="glyphicon glyphicon-trash"></span></button>' +
          '</div><div class="panel-body message-body">' + IC.escapeHtml(m.message) + '</div></div>';
      }).join('');
    }).catch(fail);
  }

  document.getElementById('messages').addEventListener('click', function (e) {
    if (!e.target.closest('.delete-msg')) return;
    var panel = e.target.closest('.panel');
    if (!confirm('Delete this message?')) return;
    IC.api('/api/admin/messages/' + panel.getAttribute('data-id'), { method: 'DELETE' }).then(function () {
      loadMessages();
      loadSummary();
    }).catch(fail);
  });
})();
