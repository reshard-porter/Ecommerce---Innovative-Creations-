// Home page: product grid, "More" button, sales, product modal, contact form.
(function () {
  'use strict';
  var IC = window.IC;
  var PAGE = 9;
  var params = new URLSearchParams(location.search);
  var filter = { category: params.get('category') || '', q: params.get('q') || '', sale: params.get('sale') === '1' };
  var sort = 'newest';
  try { sort = localStorage.getItem('ic-sort') || 'newest'; } catch (e) { /* storage blocked */ }
  var offset = 0;
  var loading = 0; // ignore late replies after the sort changes

  var grid = document.getElementById('product-grid');
  var moreBtn = document.getElementById('more-btn');
  var empty = document.getElementById('products-empty');
  var countEl = document.getElementById('products-count');
  var sortSelect = document.getElementById('sort-select');
  sortSelect.value = sort;

  function query(extra) {
    var p = new URLSearchParams();
    if (filter.category) p.set('category', filter.category);
    if (filter.q) p.set('q', filter.q);
    if (filter.sale) p.set('sale', '1');
    p.set('sort', sort);
    Object.keys(extra || {}).forEach(function (k) { p.set(k, extra[k]); });
    return '/api/products?' + p.toString();
  }

  function loadProducts() {
    var ticket = loading;
    moreBtn.disabled = true;
    IC.api(query({ limit: PAGE, offset: offset })).then(function (data) {
      if (ticket !== loading) return;
      grid.insertAdjacentHTML('beforeend', data.products.map(IC.productTile).join(''));
      offset += data.products.length;
      empty.hidden = data.total > 0;
      countEl.textContent = data.total ? 'Showing ' + offset + ' of ' + data.total + ' products' : '';
      moreBtn.hidden = offset >= data.total;
      moreBtn.disabled = false;
    }).catch(function (err) {
      empty.textContent = 'Could not load products: ' + err.message;
      empty.hidden = false;
    });
  }

  function reload() {
    loading++;
    offset = 0;
    grid.innerHTML = '';
    loadProducts();
  }

  sortSelect.addEventListener('change', function () {
    sort = this.value;
    try { localStorage.setItem('ic-sort', sort); } catch (e) { /* storage blocked */ }
    reload();
  });

  // Heading for search / category / sale results.
  if (filter.q || filter.category || filter.sale) {
    document.getElementById('filter-bar').hidden = false;
    document.getElementById('products-sub').textContent = '';
    var title = document.getElementById('products-title');
    if (filter.q) {
      title.textContent = 'Results for "' + filter.q + '"';
    } else if (filter.category) {
      IC.api('/api/categories').then(function (cats) {
        var c = cats.filter(function (x) { return String(x.id) === filter.category; })[0];
        if (c) title.textContent = c.name;
      });
    } else {
      title.textContent = 'All sale items';
    }
    // Jump to results when arriving from the search box.
    if (!location.hash) location.hash = 'products';
  }

  moreBtn.addEventListener('click', loadProducts);
  loadProducts();

  IC.api('/api/products?sale=1&limit=6').then(function (data) {
    document.getElementById('sales-grid').innerHTML = data.products.map(IC.productTile).join('');
    document.getElementById('sales-empty').hidden = data.products.length > 0;
    document.getElementById('all-sales-btn').hidden = data.total <= data.products.length;
    if (data.total > data.products.length) {
      document.getElementById('all-sales-btn').textContent = 'See all ' + data.total + ' sale items';
    }
  }).catch(function () {
    document.getElementById('sales-empty').hidden = false;
  });

  // ---------- Product modal ----------
  var current = null;
  var modalAlert = document.getElementById('product-modal-alert');

  document.addEventListener('click', function (e) {
    var tile = e.target.closest('.product-tile');
    if (!tile) return;
    IC.api('/api/products/' + tile.getAttribute('data-id')).then(function (p) {
      current = p;
      document.getElementById('product-modal-title').textContent = p.name;
      document.getElementById('product-modal-image').innerHTML = IC.productImage(p);
      document.getElementById('product-modal-category').textContent = p.category || '';
      document.getElementById('product-modal-description').textContent = p.description || '';
      document.getElementById('product-modal-price').innerHTML = IC.priceHtml(p);
      document.getElementById('product-modal-stock').textContent = p.stock > 0 ? p.stock + ' in stock' : 'Out of stock';
      var qty = document.getElementById('product-modal-qty');
      qty.value = 1;
      qty.max = p.stock;
      document.getElementById('product-modal-add').disabled = p.stock < 1;
      modalAlert.hidden = true;
      $('#product-modal').modal('show');
    });
  });

  document.getElementById('product-modal-add').addEventListener('click', function () {
    if (!current) return;
    var qty = parseInt(document.getElementById('product-modal-qty').value, 10) || 1;
    IC.api('/api/cart', { method: 'POST', body: { productId: current.id, quantity: qty } }).then(function (cart) {
      IC.setCartCount(cart.count);
      modalAlert.innerHTML = 'Added to your cart. <a href="/cart" class="alert-link">View cart</a>';
      modalAlert.className = 'alert alert-success';
      modalAlert.hidden = false;
    }).catch(function (err) {
      IC.showAlert(modalAlert, 'danger', err.message);
    });
  });

  // ---------- Contact form ----------
  var contactForm = document.getElementById('contact-form');
  var contactAlert = document.getElementById('contact-alert');
  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = contactForm.elements; // (contactForm.name would be the form's own name, not the input)
    var body = { name: f.name.value, email: f.email.value, message: f.message.value };
    var btn = contactForm.querySelector('button[type=submit]');
    btn.disabled = true;
    IC.api('/api/contact', { method: 'POST', body: body }).then(function () {
      IC.showAlert(contactAlert, 'success', 'Thanks! Your message has been sent.');
      contactForm.reset();
    }).catch(function (err) {
      IC.showAlert(contactAlert, 'danger', err.message);
    }).then(function () { btn.disabled = false; });
  });
})();
