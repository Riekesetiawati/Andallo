import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, defaultDbFile, verifyPassword } from '../server.js';

let app;
let base;
let tmpDir;

function futureDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

async function call(method, url, { token, body } = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}

async function login(email, password = 'Demo1234') {
  const { status, data } = await call('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(status, 200, JSON.stringify(data));
  return data.token;
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'andallo-'));
  fs.copyFileSync(path.resolve('data/db.json'), path.join(tmpDir, 'db.json'));
  app = createApp({ dbFile: path.join(tmpDir, 'db.json'), env: {}, background: false });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await app.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('serves the website and blocks path traversal', async () => {
  const home = await call('GET', '/');
  assert.equal(home.status, 200);
  assert.match(home.data, /Andallo/);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  const escaped = await fetch(`${base}/..%2fserver.js`);
  assert.ok([403, 404].includes(escaped.status));
});

test('passwords are hashed and hidden from clients', async () => {
  const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'db.json'), 'utf8'));
  assert.ok(onDisk.users.every((user) => verifyPassword('Demo1234', user.passwordHash) && user.password === undefined));
  const { data } = await call('POST', '/api/auth/login', { body: { email: 'rieke@andallo.com', password: 'Demo1234' } });
  assert.equal(data.user.passwordHash, undefined);
  assert.equal(data.user.role, 'customer');
});

test('registration validates input and rejects a duplicate email', async () => {
  const bad = await call('POST', '/api/auth/register', { body: { name: 'A', email: 'nope', phone: '123', password: 'secret', confirmPassword: 'secret' } });
  assert.equal(bad.status, 400);
  const created = await call('POST', '/api/auth/register', {
    body: { name: 'Sinta Maharani', email: 'sinta@example.com', phone: '081234009988', password: 'Rahasia1', confirmPassword: 'Rahasia1' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.user.role, 'customer');
  const duplicate = await call('POST', '/api/auth/register', {
    body: { name: 'Sinta Maharani', email: 'sinta@example.com', phone: '081234009988', password: 'Rahasia1', confirmPassword: 'Rahasia1' },
  });
  assert.equal(duplicate.status, 409);
});

test('customers cannot call admin endpoints', async () => {
  const customer = await login('rieke@andallo.com');
  assert.equal((await call('GET', '/api/admin/stats', { token: customer })).status, 403);
  assert.equal((await call('POST', '/api/services', { token: customer, body: { name: 'X' } })).status, 403);
  assert.equal((await call('GET', '/api/customers', { token: customer })).status, 403);
  assert.equal((await call('GET', '/api/bookings')).status, 401);
});

test('service search filters by keyword, category, price, and rating', async () => {
  const all = await call('GET', '/api/services');
  assert.equal(all.data.services.length, 9);
  const photo = await call('GET', '/api/services?q=pernikahan&category=cat_foto');
  assert.ok(photo.data.services.every((service) => service.categoryName === 'Fotografi'));
  assert.ok(photo.data.services.some((service) => /Fotografi Pernikahan/.test(service.name)));
  const cheap = await call('GET', '/api/services?maxPrice=200000&sort=price_asc');
  assert.ok(cheap.data.services.every((service) => service.price <= 200000));
  assert.equal(cheap.data.services[0].price <= cheap.data.services.at(-1).price, true);
  const rated = await call('GET', '/api/services?minRating=4.5&sort=rating');
  assert.ok(rated.data.services.every((service) => service.rating >= 4.5));
  const provider = await call('GET', '/api/services?q=BersihHati');
  assert.equal(provider.data.services.length, 1);
});

test('booking creates a record, blocks a taken slot, and only then allows a review', async () => {
  const customer = await login('rieke@andallo.com');
  const admin = await login('admin@andallo.com');
  const date = futureDate(9);
  const created = await call('POST', '/api/bookings', {
    token: customer,
    body: { serviceId: 'svc_salon', packageId: 'pkg_salon_rambut', date, time: '14:00', location: 'Salon Pelukan, Setiabudi, Bandung', notes: 'Rambut kering' },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.match(created.data.booking.id, /^ADL-/);
  assert.equal(created.data.booking.status, 'pending');
  assert.equal(created.data.booking.total, created.data.booking.price + created.data.booking.platformFee);
  const clash = await call('POST', '/api/bookings', {
    token: customer,
    body: { serviceId: 'svc_salon', packageId: 'pkg_salon_rambut', date, time: '14:00', location: 'Alamat lain yang cukup panjang' },
  });
  assert.equal(clash.status, 409);
  const early = await call('POST', '/api/reviews', { token: customer, body: { bookingId: created.data.booking.id, rating: 5, text: 'Terlalu cepat untuk diulas.' } });
  assert.equal(early.status, 409);
  const customerComplete = await call('PUT', `/api/bookings/${created.data.booking.id}`, { token: customer, body: { status: 'completed' } });
  assert.equal(customerComplete.status, 403);
  const done = await call('PUT', `/api/bookings/${created.data.booking.id}`, { token: admin, body: { status: 'completed' } });
  assert.equal(done.data.booking.status, 'completed');
  const review = await call('POST', '/api/reviews', { token: customer, body: { bookingId: created.data.booking.id, rating: 5, text: 'Rambutnya rapi dan wangi, sesuai yang dijanjikan.' } });
  assert.equal(review.status, 201);
  const again = await call('POST', '/api/reviews', { token: customer, body: { bookingId: created.data.booking.id, rating: 4, text: 'Tidak boleh ulasan kedua.' } });
  assert.equal(again.status, 409);
  const listed = await call('GET', '/api/reviews?serviceId=svc_salon');
  assert.ok(listed.data.reviews.some((item) => item.bookingId === created.data.booking.id));
});

test('a finished seeded booking can be reviewed and an open provider cannot be deleted', async () => {
  const customer = await login('rieke@andallo.com');
  const admin = await login('admin@andallo.com');
  const review = await call('POST', '/api/reviews', { token: customer, body: { bookingId: 'ADL-1003', rating: 4, text: 'Makanannya hangat dan porsinya cukup untuk tamu kami.' } });
  assert.equal(review.status, 201);
  const blocked = await call('DELETE', '/api/providers/prv_cahaya', { token: admin });
  assert.equal(blocked.status, 409);
});

test('saved services and profile updates persist', async () => {
  const customer = await login('rieke@andallo.com');
  const saved = await call('POST', '/api/saved', { token: customer, body: { serviceId: 'svc_event' } });
  assert.equal(saved.status, 200);
  const list = await call('GET', '/api/saved', { token: customer });
  assert.ok(list.data.services.some((service) => service.id === 'svc_event'));
  await call('DELETE', '/api/saved/svc_event', { token: customer });
  const after = await call('GET', '/api/saved', { token: customer });
  assert.equal(after.data.services.some((service) => service.id === 'svc_event'), false);
  const profile = await call('PUT', '/api/me', { token: customer, body: { name: 'Rieke Setiawati', phone: '081200011122' } });
  assert.equal(profile.data.user.phone, '081200011122');
});

test('forgot password resets the hash without email delivery', async () => {
  const forgot = await call('POST', '/api/auth/forgot', { body: { email: 'budi@andallo.com' } });
  assert.equal(forgot.status, 200);
  assert.match(forgot.data.demoResetPath, /token=/);
  const token = new URL('http://local/' + forgot.data.demoResetPath.replace('/#/', '')).searchParams.get('token') || forgot.data.demoResetPath.split('token=')[1];
  const reset = await call('POST', '/api/auth/reset', { body: { token, password: 'Baru1234' } });
  assert.equal(reset.status, 200);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'budi@andallo.com', password: 'Demo1234' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'budi@andallo.com', password: 'Baru1234' } })).status, 200);
});

test('admin can create a category and a service that customers can find', async () => {
  const admin = await login('admin@andallo.com');
  const category = await call('POST', '/api/categories', { token: admin, body: { name: 'Dekorasi' } });
  assert.equal(category.status, 201);
  const service = await call('POST', '/api/services', {
    token: admin,
    body: {
      name: 'Dekorasi Lamaran Mini',
      providerId: 'prv_ruang',
      categoryId: category.data.category.id,
      description: 'Rangkaian bunga dan kain untuk lamaran di rumah, dipasang pada hari yang sama.',
      city: 'Jakarta',
      location: 'Jakarta Pusat',
      images: ['https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80'],
      packages: [{ name: 'Sudut foto', description: 'Satu sudut dekor.', price: 1750000, duration: '4 jam' }],
      available: true,
      active: true,
      featured: true,
    },
  });
  assert.equal(service.status, 201, JSON.stringify(service.data));
  const found = await call('GET', `/api/services?q=${encodeURIComponent('Dekorasi Lamaran')}`);
  assert.equal(found.data.services.length, 1);
  const hidden = await call('PUT', `/api/services/${service.data.service.id}`, { token: admin, body: { active: false } });
  assert.equal(hidden.status, 200);
  const gone = await call('GET', `/api/services/${service.data.service.id}`);
  assert.equal(gone.status, 404);
});

test('admin stats count customers and logout invalidates the token', async () => {
  const admin = await login('admin@andallo.com');
  const stats = await call('GET', '/api/admin/stats', { token: admin });
  assert.equal(stats.status, 200);
  assert.ok(stats.data.stats.customers >= 4);
  assert.ok(stats.data.stats.revenue > 0);
  const token = await login('dina@andallo.com');
  await call('POST', '/api/auth/logout', { token });
  assert.equal((await call('GET', '/api/me', { token })).status, 401);
});

test('vercel mode seeds a writable copy of the bundled database', () => {
  const dest = path.join(tmpDir, 'vercel-db.json');
  assert.equal(defaultDbFile({ VERCEL: '1', VERCEL_DB_FILE: dest }), dest);
  assert.equal(JSON.parse(fs.readFileSync(dest, 'utf8')).services.length, 9);
});
