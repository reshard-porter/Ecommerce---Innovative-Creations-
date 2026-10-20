// Database connection, table creation and sample data.
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nodet'
};

let pool;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS Users (
     Userid     INT AUTO_INCREMENT PRIMARY KEY,
     Firstname  VARCHAR(100) NOT NULL,
     Lastname   VARCHAR(100) NOT NULL,
     Email      VARCHAR(255) NOT NULL UNIQUE,
     Gender     ENUM('Female','Male') NULL,
     Password   VARCHAR(255) NOT NULL,
     UserType   ENUM('Business Owner','Customer') NOT NULL DEFAULT 'Customer',
     CreatedAt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS Categories (
     Categoryid INT AUTO_INCREMENT PRIMARY KEY,
     Name       VARCHAR(100) NOT NULL UNIQUE
   )`,
  `CREATE TABLE IF NOT EXISTS Products (
     Productid   INT AUTO_INCREMENT PRIMARY KEY,
     Categoryid  INT NULL,
     Name        VARCHAR(150) NOT NULL,
     Description TEXT,
     Price       DECIMAL(10,2) NOT NULL,
     SalePrice   DECIMAL(10,2) NULL,
     ImageUrl    VARCHAR(255) NULL,
     Stock       INT NOT NULL DEFAULT 0,
     CreatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (Categoryid) REFERENCES Categories(Categoryid) ON DELETE SET NULL
   )`,
  `CREATE TABLE IF NOT EXISTS Orders (
     Orderid   INT AUTO_INCREMENT PRIMARY KEY,
     Userid    INT NOT NULL,
     Total     DECIMAL(10,2) NOT NULL,
     CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (Userid) REFERENCES Users(Userid)
   )`,
  `CREATE TABLE IF NOT EXISTS OrderItems (
     Orderid   INT NOT NULL,
     Productid INT NOT NULL,
     Quantity  INT NOT NULL,
     UnitPrice DECIMAL(10,2) NOT NULL,
     PRIMARY KEY (Orderid, Productid),
     FOREIGN KEY (Orderid) REFERENCES Orders(Orderid) ON DELETE CASCADE,
     FOREIGN KEY (Productid) REFERENCES Products(Productid)
   )`,
  `CREATE TABLE IF NOT EXISTS Messages (
     Messageid INT AUTO_INCREMENT PRIMARY KEY,
     Name      VARCHAR(150) NOT NULL,
     Email     VARCHAR(255) NOT NULL,
     Message   TEXT NOT NULL,
     CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  // Small key/value table that remembers one-time setup steps (e.g. which catalog was loaded).
  `CREATE TABLE IF NOT EXISTS Meta (
     K VARCHAR(50) PRIMARY KEY,
     V VARCHAR(255) NOT NULL
   )`
];

const SAMPLE_CATEGORIES = ['Home Decor', 'Kitchen', 'Accessories', 'Stationery', 'Gifts'];

// The full product catalog (250+ items) lives in data/products.json.
const CATALOG = require('./data/products.json');
const CATALOG_VERSION = '1';

// Free photos from Unsplash (https://unsplash.com/license) - loaded straight from their image server.
const photo = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=75`;

// [name, category, description, price, salePrice, stock, imageUrl]
const SAMPLE_PRODUCTS = [
  ['Handwoven Basket', 'Home Decor', 'Natural fibre basket, perfect for storage or display.', 35.00, null, 12, photo('1455669175216-9017c9b02fc6')],
  ['Ceramic Vase', 'Home Decor', 'Hand-glazed ceramic vase with a soft matte finish.', 48.00, 39.00, 8, photo('1612196808214-b8e1d6145a8c')],
  ['Wooden Serving Board', 'Kitchen', 'Solid wood board for cutting, serving and display.', 25.00, null, 20, photo('1662490880794-dd3a639ce006')],
  ['Spice Jar Set', 'Kitchen', 'Airtight jars to keep your spices fresh.', 30.00, 24.00, 15, photo('1599536884823-1bc4fb5f9dea')],
  ['Leather Wallet', 'Accessories', 'Slim bifold wallet in full-grain leather.', 55.00, null, 10, photo('1601592996763-f05c9c80a7f1')],
  ['Beaded Bracelet', 'Accessories', 'Handmade bracelet with glass beads.', 18.00, 14.00, 30, photo('1629890731335-52295b8be1d9')],
  ['Spiral Notebook', 'Stationery', 'A5 notebook made from recycled paper.', 12.00, null, 40, photo('1612367980327-7454a7276aa7')],
  ['Fountain Pen', 'Stationery', 'Gold-trim fountain pen with an engraved nib.', 28.00, null, 9, photo('1518674660708-0e2c0473e68e')],
  ['Scented Candle', 'Gifts', 'Coconut and lime soy candle in an amber jar, 40 hour burn.', 22.00, 18.00, 25, photo('1612293905607-b003de9e54fb')],
  ['Gift Box', 'Gifts', 'A wrapped box of our best-sellers - ready to give.', 95.00, null, 5, photo('1549465220-1a8b9238cd48')],
  ['Wall Clock', 'Home Decor', 'Classic round wall clock, silent movement.', 60.00, null, 6, photo('1563861826100-9cb868fdbe1c')],
  ['Coffee Mug', 'Kitchen', 'Stoneware mug, 350 ml.', 16.00, null, 35, photo('1507133750040-4a8f57021571')]
];

// Names used by the first version of the sample data, so an existing database gets the photos too.
const OLD_NAMES = {
  'Wooden Serving Board': 'Bamboo Cutting Board',
  'Spiral Notebook': 'Recycled Notebook',
  'Fountain Pen': 'Calligraphy Pen Set',
  'Gift Box': 'Gift Hamper'
};

async function init() {
  // Create the database itself if it does not exist yet.
  const { database, ...serverConfig } = config;
  const bootstrap = await mysql.createConnection(serverConfig);
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await bootstrap.end();

  pool = mysql.createPool({ ...config, waitForConnections: true, connectionLimit: 10, timezone: 'Z' });
  // Keep MySQL and Node in agreement about times (stored as UTC, shown in the visitor's own time zone).
  pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

  for (const sql of TABLES) await pool.query(sql);

  for (const name of SAMPLE_CATEGORIES) {
    await pool.query('INSERT IGNORE INTO Categories (Name) VALUES (?)', [name]);
  }

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM Products');
  if (n === 0) {
    await insertProducts(SAMPLE_PRODUCTS.map(([name, category, description, price, salePrice, stock, imageUrl]) =>
      ({ name, category, description, price, salePrice, stock, imageUrl })));
    console.log('Added sample categories and products.');
  } else {
    // Give photos to sample products created before images were added (only ones still without a photo).
    for (const [name, , desc, , , , image] of SAMPLE_PRODUCTS) {
      await pool.query(
        'UPDATE Products SET Name = ?, Description = ?, ImageUrl = ? WHERE ImageUrl IS NULL AND (Name = ? OR Name = ?)',
        [name, desc, image, name, OLD_NAMES[name] || name]
      );
    }
  }

  // Load the full catalog once. Products that already exist (same name) are skipped, and anything
  // an owner deletes later is not added back, because this only runs when the catalog version changes.
  const [[loaded]] = await pool.query("SELECT V FROM Meta WHERE K = 'catalog_version'");
  if (!loaded || loaded.V !== CATALOG_VERSION) {
    const existing = new Set((await query('SELECT Name FROM Products')).map((r) => r.Name));
    const fresh = CATALOG.filter((p) => !existing.has(p.name))
      .map((p) => ({ ...p, imageUrl: photo(p.photo) }));
    await insertProducts(fresh);
    await pool.query("REPLACE INTO Meta (K, V) VALUES ('catalog_version', ?)", [CATALOG_VERSION]);
    console.log(`Added ${fresh.length} catalog products.`);
  }
  console.log(`Connected to MySQL database "${database}".`);
}

async function insertProducts(list) {
  if (!list.length) return;
  for (const c of new Set(list.map((p) => p.category))) {
    await pool.query('INSERT IGNORE INTO Categories (Name) VALUES (?)', [c]);
  }
  const ids = Object.fromEntries((await query('SELECT Categoryid, Name FROM Categories')).map((c) => [c.Name, c.Categoryid]));
  const rows = list.map((p) => [ids[p.category] ?? null, p.name, p.description, p.price, p.salePrice ?? null, p.stock, p.imageUrl ?? null]);
  for (let i = 0; i < rows.length; i += 100) {
    await pool.query('INSERT INTO Products (Categoryid, Name, Description, Price, SalePrice, Stock, ImageUrl) VALUES ?', [rows.slice(i, i + 100)]);
  }
}

function query(sql, params) {
  return pool.query(sql, params).then(([rows]) => rows);
}

function getPool() {
  return pool;
}

module.exports = { init, query, getPool };
