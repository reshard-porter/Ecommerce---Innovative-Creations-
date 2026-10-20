# Innovative Creations

Innovative Creations is a full-stack online store built with Node.js, Express, and MySQL. Shoppers can browse 269 products across five categories, search, sort, add items to a cart and check out. Customers can view their order history, while business owners manage products, orders and messages from a secure dashboard. Passwords are securely hashed.

Built with Node.js, Express, MySQL and Bootstrap 3.

## Run it

1. Install **Node.js 18+** and **MySQL** (or XAMPP/WAMP/MariaDB) and start the MySQL server.
2. In this folder run:

   ```
   npm install
   npm start
   ```

3. Open <http://localhost:8080>.

On first start the server creates the `nodet` database, all tables, and 269 products with photos across 5 categories.

## Settings

Defaults match a local XAMPP install (user `root`, no password). Change them with environment variables:

| Variable | Default |
|---|---|
| `PORT` | `8080` |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` |
| `DB_USER` / `DB_PASSWORD` | `root` / *(empty)* |
| `DB_NAME` | `nodet` |
| `SESSION_SECRET` | dev value - **set this before going live** |
| `OWNER_CODE` | `owner-2026` - code needed to sign up as a Business Owner. **Change it before going live** |

Example (Windows PowerShell): `$env:DB_PASSWORD="secret"; npm start`
Example (macOS/Linux): `DB_PASSWORD=secret npm start`

## Using the site

- **Customers** browse, search, add to cart, check out, and see past orders under **My orders**.
- **Business Owners** sign up with the business access code (`OWNER_CODE`) and get a **Dashboard** link in the header:
  sales summary, add / edit / delete products (with photos), all orders, and contact-form messages.

## Structure

```
server.js        Express server: pages + JSON API (accounts, products, cart, checkout, contact)
db.js            MySQL connection, table creation, sample data
data/products.json  The product catalog (257 items) loaded into the database once
public/          Everything the browser loads
  index.html     Home: carousel, new products, sales, contact
  login.html     Login
  register.html  Sign up
  cart.html      Cart and checkout
  orders.html    Customer order history
  dashboard.html Business Owner dashboard
  404.html       Not-found page
  css/style.css  Site styles
  js/layout.js   Shared header/footer + helpers
  js/*.js        Page scripts
```

## Database tables

`Users`, `Categories`, `Products`, `Orders`, `OrderItems`, `Messages` (contact form).
Passwords are stored as bcrypt hashes, never as plain text.

Add and edit products from the Dashboard. For a photo, paste a web address, or put the file in
`public/img/` and enter `/img/your-file.jpg`. If a photo can't load, a placeholder icon is shown instead.

To change the starter catalog, edit `data/products.json`, then raise `CATALOG_VERSION` in `db.js`.
On the next start, any catalog products whose names aren't in the database yet are added.
Products you delete from the Dashboard are not added back unless you raise the version again.

Sample product and slideshow photos are free-to-use images from [Unsplash](https://unsplash.com/license),
loaded from Unsplash's servers, so they need an internet connection.
