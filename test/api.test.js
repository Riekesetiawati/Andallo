import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, verifyPassword } from '../server.js';

const SEED = path.resolve(import.meta.dirname, '../data/db.json');
let app;
let base;
let tmpDir;

function futureDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function call(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function login(email, password = 'demo123') {
  const { status, data } = await call('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(status, 200, `login ${email} failed: ${JSON.stringify(data)}`);
  return data.token;
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'andallo-test-'));
  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  // Exercise the plaintext → hash migration path regardless of the committed seed's state.
  for (const u of seed.users) {
    delete u.passwordHash;
    u.password = 'demo123';
  }
  fs.writeFileSync(path.join(tmpDir, 'db.json'), JSON.stringify(seed));
  app = createApp({ dbFile: path.join(tmpDir, 'db.json'), env: {} });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await app.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('serves the web app and logo', async () => {
  const home = await call('GET', '/');
  assert.equal(home.status, 200);
  assert.match(home.data, /<div id="app"/);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  const logo = await fetch(base + '/assets/andallo-logo.png');
  assert.equal(logo.status, 200);
  assert.equal(logo.headers.get('content-type'), 'image/png');
});

test('blocks path traversal outside public/', async () => {
  const res = await fetch(base + '/..%2fserver.js');
  assert.ok([403, 404].includes(res.status));
  const res2 = await fetch(base + '/%2e%2e/data/db.json');
  assert.ok([403, 404].includes(res2.status));
});

test('migrates plaintext passwords to scrypt hashes', async () => {
  await app.store.flush();
  const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, 'db.json'), 'utf8'));
  for (const u of onDisk.users) {
    assert.equal(u.password, undefined);
    assert.ok(verifyPassword('demo123', u.passwordHash));
  }
  assert.ok(onDisk.chatTemplates.customer.length > 0);
});

test('login works for all demo roles and never leaks password data', async () => {
  for (const email of ['rieke@andallo.com', 'mitra@andallo.com', 'admin@andallo.com']) {
    const { status, data } = await call('POST', '/api/auth/login', { body: { email, password: 'demo123' } });
    assert.equal(status, 200);
    assert.ok(data.token.length > 20);
    assert.equal(data.user.password, undefined);
    assert.equal(data.user.passwordHash, undefined);
  }
  const bad = await call('POST', '/api/auth/login', { body: { email: 'rieke@andallo.com', password: 'wrong' } });
  assert.equal(bad.status, 401);
});

test('protected endpoints require a valid token and the right role', async () => {
  assert.equal((await call('GET', '/api/bookings')).status, 401);
  assert.equal((await call('GET', '/api/bookings', { token: 'forged' })).status, 401);
  const customer = await login('rieke@andallo.com');
  assert.equal((await call('GET', '/api/admin/overview', { token: customer })).status, 403);
  assert.equal((await call('POST', '/api/bookings/1001/decision', { token: customer, body: { decision: 'accept' } })).status, 403);
});

test('provider search filters, sorts and returns distance', async () => {
  const all = await call('GET', '/api/providers');
  assert.equal(all.status, 200);
  assert.equal(all.data.providers.length, 35);
  assert.equal(all.data.providers[0].providerEmail, undefined);
  const distances = all.data.providers.map((p) => p.distanceKm);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));

  const cheap = await call('GET', '/api/providers?category=Otomotif&sort=price_asc');
  assert.ok(cheap.data.providers.every((p) => p.category === 'Otomotif'));
  assert.equal(cheap.data.providers[0].price, 145000);

  const q = await call('GET', '/api/providers?q=barber');
  assert.ok(q.data.providers.length >= 3);
});

test('booking lifecycle: create → locked date → accept → progress → done → rating', async () => {
  const customer = await login('rieke@andallo.com');
  const mitra = await login('mitra@andallo.com');
  const date = futureDate(3);

  const created = await call('POST', '/api/bookings', { token: customer, body: { providerId: 1, date, time: '10:00', note: 'Tes' } });
  assert.equal(created.status, 201);
  const id = created.data.booking.id;
  assert.equal(created.data.booking.status, 'PENDING');
  assert.ok(Date.parse(created.data.booking.approvalExpiresAt) > Date.now());

  const booked = await call('GET', '/api/providers/1/booked-dates');
  assert.ok(booked.data.bookedDates.includes(date));
  const clash = await call('POST', '/api/bookings', { token: customer, body: { providerId: 1, date, time: '14:00' } });
  assert.equal(clash.status, 409);

  const mitraList = await call('GET', '/api/bookings', { token: mitra });
  assert.ok(mitraList.data.bookings.some((b) => b.id === id));

  const accepted = await call('POST', `/api/bookings/${id}/decision`, { token: mitra, body: { decision: 'accept' } });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.booking.status, 'ACCEPTED');

  const earlyRating = await call('POST', `/api/bookings/${id}/rating`, { token: customer, body: { stars: 5 } });
  assert.equal(earlyRating.status, 409);

  const loc = await call('POST', `/api/bookings/${id}/location`, { token: customer, body: { lat: -6.24, lng: 106.97 } });
  assert.equal(loc.status, 200);

  for (const status of ['ON_THE_WAY', 'IN_PROGRESS', 'SELESAI']) {
    const res = await call('POST', `/api/bookings/${id}/status`, { token: mitra, body: { status } });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.booking.status, status);
  }

  const rated = await call('POST', `/api/bookings/${id}/rating`, { token: customer, body: { stars: 5, comment: 'Mantap' } });
  assert.equal(rated.status, 200);
  assert.equal(rated.data.booking.rated, true);
  assert.equal(rated.data.provider.reviews, 102);

  const again = await call('POST', `/api/bookings/${id}/rating`, { token: customer, body: { stars: 4 } });
  assert.equal(again.status, 409);

  const freed = await call('GET', '/api/providers/1/booked-dates');
  assert.ok(!freed.data.bookedDates.includes(date));
});

test('pending bookings expire after the approval window and free the date', async () => {
  const customer = await login('rieke@andallo.com');
  const mitra = await login('mitra@andallo.com');
  const date = futureDate(5);
  const { data } = await call('POST', '/api/bookings', { token: customer, body: { providerId: 1, date, time: '09:00' } });
  const booking = app.store.data.bookings.find((b) => b.id === data.booking.id);
  booking.approvalExpiresAt = new Date(Date.now() - 1000).toISOString();
  app.expirePendingBookings();
  assert.equal(booking.status, 'EXPIRED');

  const late = await call('POST', `/api/bookings/${booking.id}/decision`, { token: mitra, body: { decision: 'accept' } });
  assert.equal(late.status, 409);
  const dates = await call('GET', '/api/providers/1/booked-dates');
  assert.ok(!dates.data.bookedDates.includes(date));
});

test('providers cannot act on other providers\' bookings', async () => {
  const customer = await login('rieke@andallo.com');
  const mitra = await login('mitra@andallo.com');
  const { data } = await call('POST', '/api/bookings', { token: customer, body: { providerId: 2, date: futureDate(4), time: '11:00' } });
  const res = await call('POST', `/api/bookings/${data.booking.id}/decision`, { token: mitra, body: { decision: 'accept' } });
  assert.equal(res.status, 404);

  const admin = await login('admin@andallo.com');
  const rejected = await call('POST', `/api/bookings/${data.booking.id}/decision`, { token: admin, body: { decision: 'reject' } });
  assert.equal(rejected.data.booking.status, 'REJECTED');
});

test('booking validation rejects past dates and bad input', async () => {
  const customer = await login('rieke@andallo.com');
  const past = await call('POST', '/api/bookings', { token: customer, body: { providerId: 3, date: '2020-01-01', time: '10:00' } });
  assert.equal(past.status, 400);
  const badTime = await call('POST', '/api/bookings', { token: customer, body: { providerId: 3, date: futureDate(2), time: '25:00' } });
  assert.equal(badTime.status, 400);
  const missing = await call('POST', '/api/bookings', { token: customer, body: { providerId: 9999, date: futureDate(2), time: '10:00' } });
  assert.equal(missing.status, 404);
  const res = await fetch(base + '/api/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customer}`, 'Content-Type': 'application/json' },
    body: '{not json',
  });
  assert.equal(res.status, 400);
});

test('chat stores messages and AI answers known questions', async () => {
  const customer = await login('rieke@andallo.com');
  const res = await call('POST', '/api/bookings/1001/chat', { token: customer, body: { text: 'Bagaimana cara pembayaran?' } });
  assert.equal(res.status, 201);
  const last = res.data.chat.at(-1);
  assert.equal(last.sender, 'ai');
  assert.match(last.text, /payment gateway/);

  const templates = await call('GET', '/api/chat-templates', { token: customer });
  assert.ok(templates.data.templates.length >= 3);
});

test('notifications are created for booking events', async () => {
  const mitra = await login('mitra@andallo.com');
  const { data } = await call('GET', '/api/notifications', { token: mitra });
  assert.ok(data.notifications.some((n) => n.title === 'Pesanan baru'));
  const read = await call('POST', '/api/notifications/read', { token: mitra });
  assert.equal(read.status, 200);
  const after = await call('GET', '/api/notifications', { token: mitra });
  assert.equal(after.data.unread, 0);
});

test('SSE stream authenticates and delivers events', async () => {
  const customer = await login('rieke@andallo.com');
  const unauth = await fetch(base + '/api/events');
  assert.equal(unauth.status, 401);

  const controller = new AbortController();
  const res = await fetch(`${base}/api/events?token=${customer}`, { signal: controller.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const readUntil = async (needle) => {
    while (!buffer.includes(needle)) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
    }
    return buffer;
  };
  await readUntil('event: ready');
  await call('POST', '/api/bookings', { token: customer, body: { providerId: 6, date: futureDate(6), time: '08:00' } });
  const text = await readUntil('event: booking');
  assert.match(text, /event: notification/);
  // Left open on purpose: after() must still shut the server down with a live SSE client.
  reader.releaseLock();
});

test('admin overview returns stats without password data', async () => {
  const admin = await login('admin@andallo.com');
  const { status, data } = await call('GET', '/api/admin/overview', { token: admin });
  assert.equal(status, 200);
  assert.equal(data.stats.providers, 35);
  assert.ok(data.users.every((u) => u.passwordHash === undefined && u.password === undefined));
});

test('logout invalidates the session token', async () => {
  const token = await login('rieke@andallo.com');
  await call('POST', '/api/auth/logout', { token });
  assert.equal((await call('GET', '/api/me', { token })).status, 401);
});
