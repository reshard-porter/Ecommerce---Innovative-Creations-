// Shared header, footer and helpers used by every page.
// Each page has <div id="site-header"></div> and <div id="site-footer"></div>.
(function () {
  'use strict';

  // ---------- Helpers (available as window.IC) ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return '$' + Number(n || 0).toFixed(2);
  }

  // fetch wrapper: sends/receives JSON and throws an Error with the server's message.
  function api(url, options) {
    options = options || {};
    var init = { method: options.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (options.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    return fetch(url, init).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || 'Request failed (' + res.status + ')');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function priceHtml(p) {
    if (p.salePrice != null) {
      return '<span class="price-old">' + money(p.price) + '</span> <span class="price-sale">' + money(p.salePrice) + '</span>';
    }
    return '<span class="price">' + money(p.price) + '</span>';
  }

  var PLACEHOLDER = '<span class="glyphicon glyphicon-picture tile-placeholder" aria-hidden="true"></span>';

  // If a product photo can't load (offline, bad link), show the placeholder icon instead of a broken image.
  // Image errors don't bubble, so listen in the capture phase.
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img.tagName !== 'IMG' || !img.classList.contains('ic-img')) return;
    img.insertAdjacentHTML('afterend', PLACEHOLDER);
    img.remove();
  }, true);

  function productImage(p) {
    return p.imageUrl
      ? '<img src="' + escapeHtml(p.imageUrl) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" class="ic-img">'
      : PLACEHOLDER;
  }

  // One product tile, matching the wireframe (image area + dark caption, overlay on hover).
  function productTile(p) {
    var img = productImage(p);
    return '' +
      '<div class="col-xs-12 col-sm-6 col-md-4 tile-col">' +
        '<button type="button" class="product-tile" data-id="' + p.id + '" aria-label="View ' + escapeHtml(p.name) + '">' +
          (p.salePrice != null ? '<span class="sale-badge">Sale</span>' : '') +
          '<div class="tile-image">' + img + '</div>' +
          '<div class="tile-caption">' +
            '<strong>' + escapeHtml(p.name) + '</strong>' +
            '<small>' + escapeHtml(p.category || 'Uncategorised') + '</small>' +
          '</div>' +
          '<div class="tile-overlay">' +
            '<span class="glyphicon glyphicon-search" aria-hidden="true"></span>' +
            '<strong>' + escapeHtml(p.name) + '</strong>' +
            '<small>' + priceHtml(p) + '</small>' +
          '</div>' +
        '</button>' +
      '</div>';
  }

  function showAlert(el, type, msg) {
    el.className = 'alert alert-' + type;
    el.textContent = msg;
    el.hidden = false;
  }

  // ---------- Header ----------
  var header = '' +
    '<header class="site-header">' +
      '<div class="topbar">' +
        '<div class="container">' +
          '<ul class="list-inline topbar-left">' +
            '<li><a href="/#products"><i class="fa fa-cube" aria-hidden="true"></i> Products</a></li>' +
            '<li><a href="/#sales"><span class="glyphicon glyphicon-usd" aria-hidden="true"></span> Sales</a></li>' +
            '<li><a href="/#contact"><i class="fa fa-envelope" aria-hidden="true"></i> Contact</a></li>' +
          '</ul>' +
          '<ul class="list-inline topbar-right" id="account-links">' +
            '<li><a href="/login"><span class="glyphicon glyphicon-log-in" aria-hidden="true"></span> Login</a></li>' +
            '<li><a href="/register"><i class="fa fa-user-plus" aria-hidden="true"></i> Sign up</a></li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="container brand-row">' +
        '<a class="brand" href="/">Innovative Creations</a>' +
        '<div class="brand-tools">' +
          '<a class="cart-link" href="/cart"><span class="glyphicon glyphicon-shopping-cart" aria-hidden="true"></span> Cart ' +
            '<span class="badge" id="cart-count">0</span></a>' +
          '<form class="search-form" action="/" method="get" role="search">' +
            '<label class="sr-only" for="site-search">Search products</label>' +
            '<span class="glyphicon glyphicon-search" aria-hidden="true"></span>' +
            '<input id="site-search" name="q" type="search" placeholder="Search">' +
          '</form>' +
        '</div>' +
      '</div>' +
      '<nav class="navbar navbar-default category-nav">' +
        '<div class="container">' +
          '<div class="navbar-header">' +
            '<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#category-menu" aria-expanded="false">' +
              '<span class="sr-only">Toggle categories</span>' +
              '<span class="icon-bar"></span><span class="icon-bar"></span><span class="icon-bar"></span>' +
            '</button>' +
            '<span class="navbar-brand visible-xs">Shop by category</span>' +
          '</div>' +
          '<div class="collapse navbar-collapse" id="category-menu">' +
            '<ul class="nav navbar-nav" id="category-links"><li><a href="/#products">All products</a></li></ul>' +
          '</div>' +
        '</div>' +
      '</nav>' +
    '</header>';

  // ---------- Footer ----------
  // Replace the "#" in the social links with your real page addresses.
  var year = new Date().getFullYear();
  var footer = '' +
    '<footer class="site-footer">' +
      '<div class="footer-top">' +
        '<div class="container">' +
          '<a class="brand brand-small" href="/">Innovative Creations</a>' +
          '<ul class="list-inline footer-top-links">' +
            '<li><a href="/#contact">Contact us</a></li>' +
            '<li><a href="/#sales">Sales</a></li>' +
            '<li><a href="/cart">Cart</a></li>' +
          '</ul>' +
        '</div>' +
      '</div>' +
      '<div class="footer-main">' +
        '<div class="container">' +
          '<div class="row footer-columns">' +
            '<div class="col-xs-6 col-sm-3"><h4>Shop</h4><ul class="list-unstyled" id="footer-categories"></ul></div>' +
            '<div class="col-xs-6 col-sm-3"><h4>Offers</h4><ul class="list-unstyled">' +
              '<li><a href="/#products">New products</a></li><li><a href="/#sales">On sale</a></li></ul></div>' +
            '<div class="col-xs-6 col-sm-3"><h4>Account</h4><ul class="list-unstyled">' +
              '<li><a href="/login">Login</a></li><li><a href="/register">Sign up</a></li><li><a href="/cart">My cart</a></li></ul></div>' +
            '<div class="col-xs-6 col-sm-3"><h4>Help</h4><ul class="list-unstyled">' +
              '<li><a href="/#contact">Contact us</a></li></ul></div>' +
          '</div>' +
          '<div class="social text-center">' +
            '<a href="#" aria-label="Facebook"><i class="fa fa-facebook"></i></a>' +
            '<a href="#" aria-label="Twitter"><i class="fa fa-twitter"></i></a>' +
            '<a href="#" aria-label="Instagram"><i class="fa fa-instagram"></i></a>' +
          '</div>' +
          '<div class="footer-bottom">' +
            '<span>&copy; ' + year + ' Innovative Creations. All rights reserved. Photos from <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a>.</span>' +
            '<a href="#top" class="to-top" aria-label="Back to top"><span class="glyphicon glyphicon-chevron-up"></span></a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</footer>';

  var headerEl = document.getElementById('site-header');
  var footerEl = document.getElementById('site-footer');
  if (headerEl) headerEl.outerHTML = header;
  if (footerEl) footerEl.outerHTML = footer;

  // Keep the search box filled when showing results.
  var q = new URLSearchParams(location.search).get('q');
  if (q) document.getElementById('site-search').value = q;

  function setCartCount(n) {
    var el = document.getElementById('cart-count');
    if (el) el.textContent = n;
  }

  // Logged-in state and cart count.
  var mePromise = api('/api/me');
  mePromise.then(function (data) {
    setCartCount(data.cartCount);
    if (!data.user) return;
    document.getElementById('account-links').innerHTML =
      '<li><span class="glyphicon glyphicon-user" aria-hidden="true"></span> Hi, ' + escapeHtml(data.user.firstname) + '</li>' +
      (data.user.userType === 'Business Owner'
        ? '<li><a href="/dashboard"><span class="glyphicon glyphicon-dashboard" aria-hidden="true"></span> Dashboard</a></li>'
        : '') +
      '<li><a href="/orders"><span class="glyphicon glyphicon-list-alt" aria-hidden="true"></span> My orders</a></li>' +
      '<li><a href="#" id="logout-link"><span class="glyphicon glyphicon-log-out" aria-hidden="true"></span> Log out</a></li>';
    document.getElementById('logout-link').addEventListener('click', function (e) {
      e.preventDefault();
      api('/api/logout', { method: 'POST' }).then(function () { location.href = '/'; });
    });
  }).catch(function () { /* header still works without it */ });

  // Categories for the nav bar and footer.
  api('/api/categories').then(function (cats) {
    var nav = '<li><a href="/#products">All products</a></li>';
    var foot = '';
    cats.forEach(function (c) {
      var link = '<a href="/?category=' + c.id + '#products">' + escapeHtml(c.name) + '</a>';
      nav += '<li>' + link + '</li>';
      foot += '<li>' + link + '</li>';
    });
    document.getElementById('category-links').innerHTML = nav;
    document.getElementById('footer-categories').innerHTML = foot;
  }).catch(function () {});

  window.IC = { api: api, money: money, escapeHtml: escapeHtml, priceHtml: priceHtml, productTile: productTile, productImage: productImage,showAlert: showAlert, setCartCount: setCartCount, me: mePromise };
})();
