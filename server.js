// Innovative Creations - web server.
// Start with:  npm install  then  npm start  and open http://localhost:8080
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = path.join(__dirname, 'public');

// Code required to sign up as a Business Owner (so customers can't give themselves dashboard access).
const OWNER_CODE = process.env.OWNER_CODE || 'owner-2026';
if (!process.env.OWNER_CODE) {
  console.warn('OWNER_CODE is not set - Business Owner sign-up code is "owner-2026". Set your own before going live.');
}
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set - using a development secret. Set it before going live.');
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(express.static(PUBLIC));

// ---------- Pages ----------
const page = (file) => (req, res) => res.sendFile(path.join(PUBLIC, file));
app.get('/', page('index.html'));
app.get('/login', page('login.html'));
app.get('/register', page('register.html'));
app.get('/cart', page('cart.html'));
app.get('/orders', page('orders.html'));
app.get('/dashboard', page('dashboard.html'));

// ---------- Helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const publicUser = (u) => ({ id: u.Userid, firstname: u.Firstname, lastname: u.Lastname, email: u.Email, userType: u.UserType });
const productRow = (p) => ({
  id: p.Productid, name: p.Name, description: p.Description, category: p.Category,
  price: Number(p.Price), salePrice: p.SalePrice === null ? null : Number(p.SalePrice),
  imageUrl: p.ImageUrl, stock: p.Stock
});
const PRODUCT_SELECT = `SELECT p.*, c.Name AS Category FROM Products p LEFT JOIN Categories c ON c.Categoryid = p.Categoryid`;

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

function requireOwner(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
  if (req.session.user.userType !== 'Business Owner') return res.status(403).json({ error: 'Only Business Owner accounts can do that.' });
  next();
}

// ---------- Accounts ----------
app.post('/api/register', asyncRoute(async (req, res) => {
  const { firstname, lastname, email, gender, userType, password, confirmPassword, ownerCode } = req.body;
  const errors = [];
  if (!firstname || !firstname.trim()) errors.push('First name is required.');
  if (!lastname || !lastname.trim()) errors.push('Last name is required.');
  if (!email || !EMAIL_RE.test(email)) errors.push('A valid email address is required.');
  if (gender && !['Female', 'Male'].includes(gender)) errors.push('Please choose a valid gender.');
  if (!['Business Owner', 'Customer'].includes(userType)) errors.push('Please choose a user type.');
  if (userType === 'Business Owner' && ownerCode !== OWNER_CODE) errors.push('The business access code is not correct.');
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
  if (password !== confirmPassword) errors.push('Passwords do not match.');
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const existing = await db.query('SELECT Userid FROM Users WHERE Email = ?', [email.toLowerCase()]);
  if (existing.length) return res.status(409).json({ error: 'An account with that email already exists.' });

  const hash = await bcrypt.hash(password, 10);
  const result = await db.query(
    'INSERT INTO Users (Firstname, Lastname, Email, Gender, Password, UserType) VALUES (?, ?, ?, ?, ?, ?)',
    [firstname.trim(), lastname.trim(), email.toLowerCase(), gender || null, hash, userType]
  );
  const [user] = await db.query('SELECT * FROM Users WHERE Userid = ?', [result.insertId]);
  const cart = req.session.cart;
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Account created, but we could not log you in. Please log in.' });
    req.session.user = publicUser(user);
    req.session.cart = cart || {};
    res.status(201).json({ user: req.session.user });
  });
}));

app.post('/api/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const [user] = await db.query('SELECT * FROM Users WHERE Email = ?', [String(email).toLowerCase()]);
  const ok = user && await bcrypt.compare(password, user.Password);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });

  const cart = req.session.cart; // keep anything added before logging in
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Could not log in.' });
    req.session.user = publicUser(user);
    req.session.cart = cart || {};
    res.json({ user: req.session.user });
  });
}));

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  const cart = req.session.cart || {};
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  res.json({ user: req.session.user || null, cartCount: count });
});

// ---------- Products ----------
app.get('/api/categories', asyncRoute(async (req, res) => {
  // The shop menus only list categories that have products; the dashboard asks for all of them.
  const sql = req.query.all === '1'
    ? 'SELECT Categoryid AS id, Name AS name FROM Categories ORDER BY Name'
    : 'SELECT c.Categoryid AS id, c.Name AS name FROM Categories c WHERE EXISTS (SELECT 1 FROM Products p WHERE p.Categoryid = c.Categoryid) ORDER BY c.Name';
  res.json(await db.query(sql));
}));

app.get('/api/products', asyncRoute(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.category) { where.push('p.Categoryid = ?'); params.push(Number(req.query.category)); }
  if (req.query.q) { where.push('(p.Name LIKE ? OR p.Description LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
  if (req.query.sale === '1') where.push('p.SalePrice IS NOT NULL');
  const SORTS = {
    newest: 'p.CreatedAt DESC, p.Productid DESC',
    price_asc: 'COALESCE(p.SalePrice, p.Price) ASC, p.Productid',
    price_desc: 'COALESCE(p.SalePrice, p.Price) DESC, p.Productid',
    name: 'p.Name ASC'
  };
  const orderBy = SORTS[req.query.sort] || SORTS.newest;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 9, 1), 50);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const rows = await db.query(`${PRODUCT_SELECT}${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM Products p${whereSql}`, params);
  res.json({ products: rows.map(productRow), total });
}));

app.get('/api/products/:id', asyncRoute(async (req, res) => {
  const [p] = await db.query(`${PRODUCT_SELECT} WHERE p.Productid = ?`, [Number(req.params.id)]);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  res.json(productRow(p));
}));

// ---------- Cart (kept in the session: { productId: quantity }) ----------
async function cartDetails(cart) {
  const ids = Object.keys(cart || {}).map(Number);
  if (!ids.length) return { items: [], total: 0, count: 0 };
  const rows = await db.query(`${PRODUCT_SELECT} WHERE p.Productid IN (?)`, [ids]);
  const items = rows.map((r) => {
    const p = productRow(r);
    const quantity = cart[p.id];
    const unitPrice = p.salePrice ?? p.price;
    return { ...p, quantity, unitPrice, lineTotal: +(unitPrice * quantity).toFixed(2) };
  });
  const total = +items.reduce((s, i) => s + i.lineTotal, 0).toFixed(2);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  return { items, total, count };
}

app.get('/api/cart', asyncRoute(async (req, res) => {
  res.json(await cartDetails(req.session.cart));
}));

app.post('/api/cart', asyncRoute(async (req, res) => {
  const productId = Number(req.body.productId);
  const qty = Math.max(parseInt(req.body.quantity, 10) || 1, 1);
  const [p] = await db.query('SELECT Productid, Stock FROM Products WHERE Productid = ?', [productId]);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const cart = req.session.cart = req.session.cart || {};
  const newQty = (cart[productId] || 0) + qty;
  if (newQty > p.Stock) return res.status(400).json({ error: `Only ${p.Stock} left in stock.` });
  cart[productId] = newQty;
  res.json(await cartDetails(cart));
}));

app.put('/api/cart/:id', asyncRoute(async (req, res) => {
  const productId = Number(req.params.id);
  const qty = parseInt(req.body.quantity, 10);
  const cart = req.session.cart = req.session.cart || {};
  if (!cart[productId]) return res.status(404).json({ error: 'That item is not in your cart.' });
  if (!qty || qty < 1) {
    delete cart[productId];
  } else {
    const [p] = await db.query('SELECT Stock FROM Products WHERE Productid = ?', [productId]);
    if (!p) { delete cart[productId]; return res.json(await cartDetails(cart)); }
    if (qty > p.Stock) return res.status(400).json({ error: `Only ${p.Stock} left in stock.` });
    cart[productId] = qty;
  }
  res.json(await cartDetails(cart));
}));

app.delete('/api/cart/:id', asyncRoute(async (req, res) => {
  const cart = req.session.cart = req.session.cart || {};
  delete cart[Number(req.params.id)];
  res.json(await cartDetails(cart));
}));

app.post('/api/checkout', requireLogin, asyncRoute(async (req, res) => {
  const { items, total } = await cartDetails(req.session.cart);
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty.' });

  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();
    for (const i of items) {
      const [r] = await conn.query('UPDATE Products SET Stock = Stock - ? WHERE Productid = ? AND Stock >= ?', [i.quantity, i.id, i.quantity]);
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.status(400).json({ error: `Sorry, "${i.name}" no longer has enough stock.` });
      }
    }
    const [order] = await conn.query('INSERT INTO Orders (Userid, Total) VALUES (?, ?)', [req.session.user.id, total]);
    for (const i of items) {
      await conn.query('INSERT INTO OrderItems (Orderid, Productid, Quantity, UnitPrice) VALUES (?, ?, ?, ?)', [order.insertId, i.id, i.quantity, i.unitPrice]);
    }
    await conn.commit();
    req.session.cart = {};
    res.status(201).json({ orderId: order.insertId, total });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// ---------- Orders ----------
async function ordersWithItems(where, params) {
  const orders = await db.query(
    `SELECT o.Orderid, o.Total, o.CreatedAt, u.Firstname, u.Lastname, u.Email
       FROM Orders o JOIN Users u ON u.Userid = o.Userid ${where}
      ORDER BY o.CreatedAt DESC, o.Orderid DESC LIMIT 200`, params);
  if (!orders.length) return [];
  const items = await db.query(
    `SELECT oi.Orderid, oi.Quantity, oi.UnitPrice, p.Name
       FROM OrderItems oi JOIN Products p ON p.Productid = oi.Productid
      WHERE oi.Orderid IN (?)`, [orders.map((o) => o.Orderid)]);
  return orders.map((o) => ({
    id: o.Orderid, total: Number(o.Total), createdAt: o.CreatedAt,
    customer: { name: `${o.Firstname} ${o.Lastname}`, email: o.Email },
    items: items.filter((i) => i.Orderid === o.Orderid)
      .map((i) => ({ name: i.Name, quantity: i.Quantity, unitPrice: Number(i.UnitPrice) }))
  }));
}

app.get('/api/orders', requireLogin, asyncRoute(async (req, res) => {
  res.json(await ordersWithItems('WHERE o.Userid = ?', [req.session.user.id]));
}));

// ---------- Business Owner dashboard ----------
app.get('/api/admin/orders', requireOwner, asyncRoute(async (req, res) => {
  res.json(await ordersWithItems('', []));
}));

app.get('/api/admin/messages', requireOwner, asyncRoute(async (req, res) => {
  res.json(await db.query('SELECT Messageid AS id, Name AS name, Email AS email, Message AS message, CreatedAt AS createdAt FROM Messages ORDER BY CreatedAt DESC, Messageid DESC LIMIT 200'));
}));

app.delete('/api/admin/messages/:id', requireOwner, asyncRoute(async (req, res) => {
  await db.query('DELETE FROM Messages WHERE Messageid = ?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

app.get('/api/admin/summary', requireOwner, asyncRoute(async (req, res) => {
  const [[p], [o], [m], [u]] = await Promise.all([
    db.query('SELECT COUNT(*) AS n, SUM(Stock = 0) AS out_of_stock FROM Products'),
    db.query('SELECT COUNT(*) AS n, COALESCE(SUM(Total), 0) AS revenue FROM Orders'),
    db.query('SELECT COUNT(*) AS n FROM Messages'),
    db.query("SELECT COUNT(*) AS n FROM Users WHERE UserType = 'Customer'")
  ]);
  res.json({
    products: p.n, outOfStock: Number(p.out_of_stock || 0),
    orders: o.n, revenue: Number(o.revenue), messages: m.n, customers: u.n
  });
}));

// Check and clean a product sent from the dashboard form.
async function productInput(body) {
  const name = String(body.name || '').trim();
  const price = Number(body.price);
  const salePrice = body.salePrice === '' || body.salePrice == null ? null : Number(body.salePrice);
  const stock = parseInt(body.stock, 10);
  const imageUrl = String(body.imageUrl || '').trim() || null;
  const categoryName = String(body.category || '').trim();
  const errors = [];
  if (!name) errors.push('Name is required.');
  if (!(price > 0)) errors.push('Price must be more than 0.');
  if (salePrice !== null && !(salePrice > 0 && salePrice < price)) errors.push('Sale price must be more than 0 and less than the price.');
  if (!(stock >= 0)) errors.push('Stock must be 0 or more.');
  if (imageUrl && !/^(https?:\/\/|\/img\/)/.test(imageUrl)) errors.push('Image must be a web address (https://...) or a file in /img/.');
  if (errors.length) return { error: errors.join(' ') };

  let categoryId = null;
  if (categoryName) {
    await db.query('INSERT IGNORE INTO Categories (Name) VALUES (?)', [categoryName]);
    [{ Categoryid: categoryId }] = await db.query('SELECT Categoryid FROM Categories WHERE Name = ?', [categoryName]);
  }
  return { values: [categoryId, name, String(body.description || '').trim(), price, salePrice, imageUrl, stock] };
}

app.post('/api/products', requireOwner, asyncRoute(async (req, res) => {
  const input = await productInput(req.body);
  if (input.error) return res.status(400).json({ error: input.error });
  const r = await db.query('INSERT INTO Products (Categoryid, Name, Description, Price, SalePrice, ImageUrl, Stock) VALUES (?, ?, ?, ?, ?, ?, ?)', input.values);
  const [p] = await db.query(`${PRODUCT_SELECT} WHERE p.Productid = ?`, [r.insertId]);
  res.status(201).json(productRow(p));
}));

app.put('/api/products/:id', requireOwner, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const input = await productInput(req.body);
  if (input.error) return res.status(400).json({ error: input.error });
  const r = await db.query('UPDATE Products SET Categoryid = ?, Name = ?, Description = ?, Price = ?, SalePrice = ?, ImageUrl = ?, Stock = ? WHERE Productid = ?', [...input.values, id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Product not found.' });
  const [p] = await db.query(`${PRODUCT_SELECT} WHERE p.Productid = ?`, [id]);
  res.json(productRow(p));
}));

app.delete('/api/products/:id', requireOwner, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM OrderItems WHERE Productid = ?', [id]);
  if (n > 0) return res.status(409).json({ error: 'This product is part of past orders, so it can\'t be deleted. Set its stock to 0 to stop selling it.' });
  await db.query('DELETE FROM Products WHERE Productid = ?', [id]);
  res.json({ ok: true });
}));

// ---------- Contact ----------
app.post('/api/contact', asyncRoute(async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !name.trim() || !email || !EMAIL_RE.test(email) || !message || !message.trim()) {
    return res.status(400).json({ error: 'Please fill in your name, a valid email and a message.' });
  }
  await db.query('INSERT INTO Messages (Name, Email, Message) VALUES (?, ?, ?)', [name.trim(), email.trim(), message.trim()]);
  res.status(201).json({ ok: true });
}));

// ---------- Errors ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, '404.html')));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

db.init()
  .then(() => {
    const server = app.listen(PORT, () => console.info(`Listening on http://localhost:${PORT}`));
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use - the site may already be running in another terminal.`);
        console.error(`Stop it there with Ctrl + C, or start this one on another port: PORT=3000 npm start`);
      } else {
        console.error(err.message);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('Could not connect to MySQL. Is it running, and are DB_USER / DB_PASSWORD correct?');
    console.error(err.message);
    process.exit(1);
  });
