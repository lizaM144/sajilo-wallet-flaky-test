// Sajilo Momo v2: lab app for Qrius Module 7 Session 3 and Module 9 (Scaling Test Execution).
// One HTML page + this one Node file + a PostgreSQL database.
// Start:             npm start
// Start flaky mode:  npm run start:flaky  (Module 9 Session 2: slow API + unreliable SMS gateway)
// Start with bugs:   npm run start:bugs   (instructor only)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 4100;
const BUG_MODE = process.argv.includes('--bugs') || process.env.BUG_MODE === '1';
// FLAKY MODE: the API answers after a random delay, and the SMS gateway fails about 1 time in 3.
// Good tests (web-first assertions, own data) still pass. Weak tests start failing at random.
const FLAKY_MODE = process.argv.includes('--flaky') || process.env.FLAKY_MODE === '1';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'sajilo_momo',
});

// Menu lives in code, prices in whole rupees
const MENU = {
  'Veg Momo': 140,
  'Buff Momo': 160,
  'Chicken Momo': 180,
  'Jhol Momo': 200,
  'Chowmein': 150,
};
const STATUSES = ['PLACED', 'DELIVERED', 'CANCELLED'];

// ---------- Helpers ----------
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(data === undefined ? '' : JSON.stringify(data));
}
// In flaky mode, some replies are fast and some are slow (like mobile data on a busy evening).
// About 4 in 10 replies come back at once; the rest wait between min and max milliseconds.
function slow(min, max) {
  if (!FLAKY_MODE || Math.random() < 0.4) return Promise.resolve();
  const ms = min + Math.floor(Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}
function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve(null); } });
  });
}
const toOrder = (r) => ({
  id: r.id,
  customerId: r.customer_id,
  customerName: r.full_name,
  item: r.item,
  qty: r.qty,
  unitPrice: r.unit_price,
  totalAmount: r.total_amount,
  status: r.status,
  createdAt: r.created_at,
});
const ORDER_SELECT = `
  SELECT o.id, o.customer_id, c.full_name, o.item, o.qty, o.unit_price,
         o.total_amount, o.status, o.created_at
  FROM orders o
  JOIN customers c ON c.id = o.customer_id`;

// ---------- API ----------
async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;
  const idMatch = url.pathname.match(/^\/api\/orders\/(\d+)(\/status)?$/);
  const smsMatch = url.pathname.match(/^\/api\/orders\/(\d+)\/sms$/);

  if (route === 'GET /api/health') {
    await pool.query('SELECT 1');
    return send(res, 200, { status: 'ok', bugMode: BUG_MODE, flakyMode: FLAKY_MODE });
  }

  if (route === 'GET /api/menu') {
    return send(res, 200, Object.entries(MENU).map(([item, price]) => ({ item, price })));
  }

  if (route === 'GET /api/customers') {
    const { rows } = await pool.query('SELECT id, full_name, phone, city FROM customers ORDER BY id');
    return send(res, 200, rows.map((r) => ({ id: r.id, fullName: r.full_name, phone: r.phone, city: r.city })));
  }

  if (route === 'GET /api/orders') {
    await slow(300, 1500);
    const { rows } = await pool.query(`${ORDER_SELECT} ORDER BY o.id DESC`);
    return send(res, 200, rows.map(toOrder));
  }

  if (route === 'POST /api/orders') {
    const body = await readBody(req);
    await slow(300, 1500);
    if (!body) return send(res, 400, { message: 'Invalid JSON body' });
    const errors = {};
    const customerId = Number(body.customerId);
    const item = String(body.item ?? '');
    const qty = Number(body.qty);

    if (!Number.isInteger(customerId) || customerId < 1) errors.customerId = 'Please choose a customer';
    else {
      const c = await pool.query('SELECT id FROM customers WHERE id = $1', [customerId]);
      if (c.rowCount === 0) errors.customerId = 'Customer not found';
    }
    if (!MENU[item]) errors.item = 'Please choose an item from the menu';
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) errors.qty = 'Quantity must be between 1 and 10';
    if (Object.keys(errors).length) return send(res, 400, { message: 'Validation failed', errors });

    const unitPrice = MENU[item];
    // BUG (bug mode): total saved to the database ignores quantity.
    // The UI calculates its own total, so the screen still looks right.
    const total = BUG_MODE ? unitPrice : qty * unitPrice;

    const ins = await pool.query(
      `INSERT INTO orders (customer_id, item, qty, unit_price, total_amount)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [customerId, item, qty, unitPrice, total]
    );
    const { rows } = await pool.query(`${ORDER_SELECT} WHERE o.id = $1`, [ins.rows[0].id]);
    return send(res, 201, toOrder(rows[0]));
  }

  if (idMatch && !idMatch[2] && req.method === 'GET') {
    const { rows } = await pool.query(`${ORDER_SELECT} WHERE o.id = $1`, [Number(idMatch[1])]);
    return rows.length ? send(res, 200, toOrder(rows[0])) : send(res, 404, { message: 'Order not found' });
  }

  if (idMatch && idMatch[2] && req.method === 'PATCH') {
    const body = await readBody(req);
    await slow(300, 1200);
    const status = String(body?.status ?? '');
    if (!STATUSES.includes(status)) return send(res, 400, { message: 'Status must be PLACED, DELIVERED or CANCELLED' });
    const upd = await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, Number(idMatch[1])]);
    if (upd.rowCount === 0) return send(res, 404, { message: 'Order not found' });
    const { rows } = await pool.query(`${ORDER_SELECT} WHERE o.id = $1`, [Number(idMatch[1])]);
    return send(res, 200, toOrder(rows[0]));
  }

  if (idMatch && !idMatch[2] && req.method === 'DELETE') {
    const del = await pool.query('DELETE FROM orders WHERE id = $1', [Number(idMatch[1])]);
    return del.rowCount ? send(res, 204) : send(res, 404, { message: 'Order not found' });
  }

  // Pretend to send an SMS confirmation through a third-party gateway.
  // In flaky mode the gateway times out about 1 time in 3, and we cannot fix it from our side.
  if (smsMatch && req.method === 'POST') {
    const { rows } = await pool.query(
      'SELECT c.phone FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1',
      [Number(smsMatch[1])]
    );
    if (!rows.length) return send(res, 404, { message: 'Order not found' });
    await slow(200, 800);
    if (FLAKY_MODE && Math.random() < 0.34) return send(res, 503, { message: 'SMS gateway timeout' });
    return send(res, 200, { sent: true, to: rows[0].phone });
  }

  if (route === 'POST /api/test/reset') {
    await pool.query(fs.readFileSync(path.join(__dirname, 'db', 'seed.sql'), 'utf8'));
    return send(res, 204);
  }

  return send(res, 404, { message: 'Not found' });
}

// ---------- Static page ----------
const INDEX = path.join(__dirname, 'public', 'index.html');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/orders')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return fs.createReadStream(INDEX).pipe(res);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Page not found');
  } catch (err) {
    console.error(err.message);
    send(res, 500, { message: 'Something went wrong. Is PostgreSQL running and did you run npm run db:setup?' });
  }
});

server.listen(PORT, () => {
  const mode = (BUG_MODE ? '  (BUG MODE ON)' : '') + (FLAKY_MODE ? '  (FLAKY MODE ON)' : '');
  console.log(`Sajilo Momo running at http://localhost:${PORT}${mode}`);
});
