import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');

const APPROVAL_WINDOW_MS = 2 * 60 * 1000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 100 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const MAX_NOTIFICATIONS = 500;
const MAX_CHAT_MESSAGES = 200;
const DEFAULT_ORIGIN = { lat: -6.2383, lng: 106.9756 };

const STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  ON_THE_WAY: 'ON_THE_WAY',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'SELESAI',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};
const ACTIVE_STATUSES = new Set([STATUS.PENDING, STATUS.ACCEPTED, STATUS.ON_THE_WAY, STATUS.IN_PROGRESS]);
const TRACKABLE_STATUSES = new Set([STATUS.ACCEPTED, STATUS.ON_THE_WAY, STATUS.IN_PROGRESS]);
const PROVIDER_TRANSITIONS = {
  [STATUS.ACCEPTED]: STATUS.ON_THE_WAY,
  [STATUS.ON_THE_WAY]: STATUS.IN_PROGRESS,
  [STATUS.IN_PROGRESS]: STATUS.DONE,
};
const STATUS_LABEL = {
  PENDING: 'Menunggu persetujuan',
  ACCEPTED: 'Diterima',
  ON_THE_WAY: 'Dalam perjalanan',
  IN_PROGRESS: 'Sedang dikerjakan',
  SELESAI: 'Selesai',
  REJECTED: 'Ditolak',
  EXPIRED: 'Kedaluwarsa',
  CANCELLED: 'Dibatalkan',
};

const DEFAULT_CHAT_TEMPLATES = {
  customer: [
    'Apakah pesanan saya sudah dikonfirmasi?',
    'Sudah sampai mana?',
    'Berapa lama lagi sampai?',
    'Saya sudah di lokasi.',
  ],
  provider: [
    'Pesanan sudah saya terima, terima kasih.',
    'Saya sedang dalam perjalanan.',
    'Sekitar 15 menit lagi sampai.',
    'Saya sudah tiba di lokasi.',
  ],
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- password hashing ----------

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// ---------- JSON file store ----------

function createStore(file) {
  let data;
  let writeChain = Promise.resolve();

  function load() {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return migrate();
  }

  // Brings older db.json files (plaintext passwords, missing collections) up to the current shape.
  function migrate() {
    let changed = false;
    for (const key of ['users', 'providers', 'bookings', 'locations', 'notifications', 'supportChats', 'aiKnowledge']) {
      if (!Array.isArray(data[key])) {
        data[key] = [];
        changed = true;
      }
    }
    if (!data.chatTemplates) {
      data.chatTemplates = DEFAULT_CHAT_TEMPLATES;
      changed = true;
    }
    for (const user of data.users) {
      if (typeof user.password === 'string') {
        user.passwordHash = hashPassword(user.password);
        delete user.password;
        changed = true;
      }
    }
    for (const booking of data.bookings) {
      if (!Array.isArray(booking.chat)) {
        booking.chat = [];
        changed = true;
      }
    }
    return changed;
  }

  function save() {
    const snapshot = JSON.stringify(data, null, 2) + '\n';
    const tmp = `${file}.${process.pid}.tmp`;
    writeChain = writeChain
      .then(async () => {
        await fsp.writeFile(tmp, snapshot);
        await fsp.rename(tmp, file);
      })
      .catch((err) => console.error('[db] write failed:', err));
    return writeChain;
  }

  const changed = load();
  if (changed) save();

  return {
    get data() {
      return data;
    },
    save,
    flush: () => writeChain,
  };
}

// ---------- helpers ----------

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function isLatLng(p) {
  return (
    p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, password, ...rest } = user;
  return rest;
}

function nextId(items, start = 1) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), start - 1) + 1;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Payload terlalu besar.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(new HttpError(400, 'Body harus berupa JSON yang valid.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
}

// ---------- WhatsApp Cloud API ----------

function createWhatsApp(env) {
  const token = env.WHATSAPP_TOKEN;
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
  const version = env.WHATSAPP_API_VERSION || 'v20.0';
  const enabled = Boolean(token && phoneId);

  return {
    enabled,
    async send(to, body) {
      if (!enabled || !to) return { sent: false, reason: 'disabled' };
      try {
        const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) console.warn('[whatsapp] send failed:', res.status, await res.text());
        return { sent: res.ok };
      } catch (err) {
        console.warn('[whatsapp] send error:', err.message);
        return { sent: false, reason: err.message };
      }
    },
  };
}

// ---------- application ----------

export function createApp({ dbFile = path.join(ROOT, 'data', 'db.json'), env = process.env } = {}) {
  const store = createStore(dbFile);
  const whatsapp = createWhatsApp(env);
  const sessions = new Map();
  const loginFailures = new Map();
  const sseClients = new Map();

  const db = () => store.data;
  const findUser = (email) => db().users.find((u) => u.email === email);
  const findProvider = (id) => db().providers.find((p) => p.id === Number(id));
  const providerUsers = (providerId) => db().users.filter((u) => u.role === 'provider' && u.providerId === providerId);
  const admins = () => db().users.filter((u) => u.role === 'admin');

  // ----- sessions -----

  function createSession(email) {
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, { email, expiresAt: Date.now() + SESSION_TTL_MS });
    return token;
  }

  function userFromToken(token) {
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      sessions.delete(token);
      return null;
    }
    return findUser(session.email) || null;
  }

  function requireUser(req, url, ...roles) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('token');
    const user = userFromToken(token);
    if (!user) throw new HttpError(401, 'Silakan masuk terlebih dahulu.');
    if (roles.length && !roles.includes(user.role)) throw new HttpError(403, 'Akses tidak diizinkan untuk peran ini.');
    return user;
  }

  // ----- realtime (SSE) -----

  function pushTo(emails, event, payload) {
    const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const email of new Set(emails)) {
      for (const res of sseClients.get(email) || []) res.write(frame);
    }
  }

  function bookingAudience(booking) {
    return [
      booking.customerEmail,
      ...providerUsers(booking.providerId).map((u) => u.email),
      ...admins().map((u) => u.email),
    ];
  }

  function notify(emails, { title, body, bookingId = null }) {
    const list = db().notifications;
    for (const email of new Set(emails)) {
      const notification = {
        id: nextId(list),
        userEmail: email,
        title,
        body,
        bookingId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      list.push(notification);
      pushTo([email], 'notification', notification);
    }
    if (list.length > MAX_NOTIFICATIONS) list.splice(0, list.length - MAX_NOTIFICATIONS);
  }

  // ----- booking helpers -----

  function canAccessBooking(user, booking) {
    if (user.role === 'admin') return true;
    if (user.role === 'customer') return booking.customerEmail === user.email;
    if (user.role === 'provider') return booking.providerId === user.providerId;
    return false;
  }

  function serializeBooking(booking) {
    const provider = findProvider(booking.providerId);
    const customer = findUser(booking.customerEmail);
    return {
      ...booking,
      statusLabel: STATUS_LABEL[booking.status] || booking.status,
      provider: provider
        ? { id: provider.id, name: provider.name, service: provider.service, city: provider.city, image: provider.image, lat: provider.lat, lng: provider.lng }
        : null,
      customer: customer ? { name: customer.name, email: customer.email } : null,
    };
  }

  function getBookingFor(user, id) {
    const booking = db().bookings.find((b) => b.id === Number(id));
    if (!booking || !canAccessBooking(user, booking)) throw new HttpError(404, 'Pesanan tidak ditemukan.');
    return booking;
  }

  function broadcastBooking(booking) {
    pushTo(bookingAudience(booking), 'booking', serializeBooking(booking));
  }

  function expirePendingBookings() {
    const now = Date.now();
    let changed = false;
    for (const booking of db().bookings) {
      if (booking.status === STATUS.PENDING && booking.approvalExpiresAt && Date.parse(booking.approvalExpiresAt) <= now) {
        booking.status = STATUS.EXPIRED;
        booking.approvalStatus = STATUS.EXPIRED;
        booking.approvalExpiresAt = null;
        changed = true;
        const provider = findProvider(booking.providerId);
        notify(bookingAudience(booking), {
          title: 'Pesanan kedaluwarsa',
          body: `Pesanan #${booking.id} (${provider?.name ?? 'penyedia'}) tidak direspons dalam 2 menit. Silakan pilih jadwal atau penyedia lain.`,
          bookingId: booking.id,
        });
        broadcastBooking(booking);
      }
    }
    if (changed) store.save();
  }

  function bookedDates(providerId, excludeId = null) {
    return [
      ...new Set(
        db()
          .bookings.filter((b) => b.providerId === providerId && ACTIVE_STATUSES.has(b.status) && b.id !== excludeId)
          .map((b) => b.date),
      ),
    ].sort();
  }

  function aiReply(text) {
    const lower = text.toLowerCase();
    const hit = db().aiKnowledge.find((k) => k.keywords.some((kw) => lower.includes(kw.toLowerCase())));
    return hit?.answer ?? null;
  }

  // ----- routes -----

  const routes = [];
  // `auth` omitted = public; [] = any signed-in user; ['admin', ...] = only those roles.
  const route = (method, pattern, handler, { auth } = {}) => {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$',
    );
    routes.push({ method, regex, keys, handler, auth });
  };

  route('GET', '/api/health', () => ({ ok: true, whatsapp: whatsapp.enabled ? 'enabled' : 'disabled' }));

  route('POST', '/api/auth/login', async ({ req, body }) => {
    const email = cleanText(body.email, 200).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) throw new HttpError(400, 'Email dan kata sandi wajib diisi.');

    const key = `${req.socket.remoteAddress}|${email}`;
    const record = loginFailures.get(key);
    if (record && record.count >= LOGIN_MAX_FAILURES && Date.now() - record.first < LOGIN_WINDOW_MS) {
      throw new HttpError(429, 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.');
    }

    const user = findUser(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      const fresh = !record || Date.now() - record.first >= LOGIN_WINDOW_MS;
      loginFailures.set(key, fresh ? { count: 1, first: Date.now() } : { ...record, count: record.count + 1 });
      throw new HttpError(401, 'Email atau kata sandi salah.');
    }
    loginFailures.delete(key);
    return { token: createSession(user.email), user: publicUser(user) };
  });

  route('POST', '/api/auth/logout', ({ req }) => {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) sessions.delete(header.slice(7));
    return { ok: true };
  });

  route('GET', '/api/me', ({ user }) => ({ user: publicUser(user) }), { auth: [] });

  route('GET', '/api/categories', () => ({
    categories: [...new Set(db().providers.map((p) => p.category))].sort(),
  }));

  route('GET', '/api/providers', ({ url }) => {
    const q = cleanText(url.searchParams.get('q'), 100).toLowerCase();
    const category = cleanText(url.searchParams.get('category'), 100);
    const sort = url.searchParams.get('sort') || 'distance';
    const lat = Number.parseFloat(url.searchParams.get('lat'));
    const lng = Number.parseFloat(url.searchParams.get('lng'));
    const origin = isLatLng({ lat, lng }) ? { lat, lng } : DEFAULT_ORIGIN;

    let list = db().providers.map(({ providerEmail, ...p }) => ({
      ...p,
      distanceKm: Math.round(haversineKm(origin, p) * 10) / 10,
    }));
    if (category) list = list.filter((p) => p.category === category);
    if (q) {
      list = list.filter((p) => [p.name, p.service, p.city, p.category].some((f) => f.toLowerCase().includes(q)));
    }
    const sorters = {
      distance: (a, b) => a.distanceKm - b.distanceKm,
      price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
    };
    list.sort(sorters[sort] || sorters.distance);
    return { origin, providers: list };
  });

  route('GET', '/api/providers/:id', ({ params }) => {
    const provider = findProvider(params.id);
    if (!provider) throw new HttpError(404, 'Penyedia tidak ditemukan.');
    const { providerEmail, ...rest } = provider;
    return { provider: rest, bookedDates: bookedDates(provider.id) };
  });

  route('GET', '/api/providers/:id/booked-dates', ({ params }) => {
    const provider = findProvider(params.id);
    if (!provider) throw new HttpError(404, 'Penyedia tidak ditemukan.');
    return { bookedDates: bookedDates(provider.id) };
  });

  route('GET', '/api/chat-templates', ({ user }) => ({
    templates: user.role === 'customer' ? db().chatTemplates.customer : db().chatTemplates.provider,
  }), { auth: [] });

  route('GET', '/api/bookings', ({ user }) => {
    const list = db()
      .bookings.filter((b) => canAccessBooking(user, b))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(serializeBooking);
    return { bookings: list };
  }, { auth: [] });

  route('GET', '/api/bookings/:id', ({ user, params }) => ({ booking: serializeBooking(getBookingFor(user, params.id)) }), { auth: [] });

  route('POST', '/api/bookings', ({ user, body }) => {
    const provider = findProvider(body.providerId);
    if (!provider) throw new HttpError(404, 'Penyedia tidak ditemukan.');
    const date = typeof body.date === 'string' ? body.date : '';
    const time = typeof body.time === 'string' ? body.time : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new HttpError(400, 'Tanggal tidak valid.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new HttpError(400, 'Jam tidak valid.');
    if (date < todayIso()) throw new HttpError(400, 'Tanggal tidak boleh di masa lalu.');
    if (bookedDates(provider.id).includes(date)) {
      throw new HttpError(409, 'Tanggal ini sudah terisi. Silakan pilih tanggal lain.');
    }
    const destination = isLatLng(body.destination) ? { lat: body.destination.lat, lng: body.destination.lng } : { ...DEFAULT_ORIGIN };

    const booking = {
      id: nextId(db().bookings, 1001),
      customerEmail: user.email,
      providerId: provider.id,
      date,
      time,
      total: provider.price,
      status: STATUS.PENDING,
      approvalStatus: STATUS.PENDING,
      approvalExpiresAt: new Date(Date.now() + APPROVAL_WINDOW_MS).toISOString(),
      rated: false,
      note: cleanText(body.note, 500),
      chat: [],
      createdAt: new Date().toISOString(),
      providerPos: { lat: provider.lat, lng: provider.lng },
      destination,
      customerPos: null,
    };
    db().bookings.push(booking);

    const providerRecipients = [...providerUsers(provider.id), ...admins()].map((u) => u.email);
    notify(providerRecipients, {
      title: 'Pesanan baru',
      body: `${user.name} memesan ${provider.service} pada ${date} ${time}. Respons dalam 2 menit.`,
      bookingId: booking.id,
    });
    notify([user.email], {
      title: 'Pesanan terkirim',
      body: `Menunggu ${provider.name} menerima pesanan #${booking.id} (maksimal 2 menit).`,
      bookingId: booking.id,
    });
    for (const u of providerUsers(provider.id)) {
      whatsapp.send(u.phone, `Andallo: pesanan baru #${booking.id} dari ${user.name} untuk ${date} ${time}. Buka dashboard untuk menerima/menolak dalam 2 menit.`);
    }
    broadcastBooking(booking);
    store.save();
    return { status: 201, body: { booking: serializeBooking(booking) } };
  }, { auth: ['customer'] });

  route('POST', '/api/bookings/:id/decision', ({ user, params, body }) => {
    const booking = getBookingFor(user, params.id);
    const decision = body.decision;
    if (!['accept', 'reject'].includes(decision)) throw new HttpError(400, 'Keputusan harus "accept" atau "reject".');
    expirePendingBookings();
    if (booking.status !== STATUS.PENDING) {
      throw new HttpError(409, `Pesanan sudah berstatus ${STATUS_LABEL[booking.status] || booking.status}.`);
    }
    const accepted = decision === 'accept';
    booking.status = accepted ? STATUS.ACCEPTED : STATUS.REJECTED;
    booking.approvalStatus = booking.status;
    booking.approvalExpiresAt = null;
    booking.decidedBy = user.email;
    booking.decidedAt = new Date().toISOString();

    const provider = findProvider(booking.providerId);
    const customer = findUser(booking.customerEmail);
    notify(bookingAudience(booking), {
      title: accepted ? 'Pesanan diterima' : 'Pesanan ditolak',
      body: accepted
        ? `${provider?.name} menerima pesanan #${booking.id} untuk ${booking.date} ${booking.time}.`
        : `${provider?.name} menolak pesanan #${booking.id}. Tanggal ${booking.date} kembali tersedia.`,
      bookingId: booking.id,
    });
    whatsapp.send(
      customer?.phone,
      `Andallo: pesanan #${booking.id} ${accepted ? 'DITERIMA' : 'DITOLAK'} oleh ${provider?.name}.`,
    );
    broadcastBooking(booking);
    store.save();
    return { booking: serializeBooking(booking) };
  }, { auth: ['provider', 'admin'] });

  route('POST', '/api/bookings/:id/status', ({ user, params, body }) => {
    const booking = getBookingFor(user, params.id);
    const target = body.status;
    let allowed = false;
    if (target === STATUS.CANCELLED) {
      allowed =
        (user.role === 'customer' && [STATUS.PENDING, STATUS.ACCEPTED].includes(booking.status)) ||
        (user.role === 'admin' && ACTIVE_STATUSES.has(booking.status));
    } else if (user.role === 'provider' || user.role === 'admin') {
      allowed = PROVIDER_TRANSITIONS[booking.status] === target;
    }
    if (!allowed) {
      throw new HttpError(409, `Tidak bisa mengubah status dari ${STATUS_LABEL[booking.status] || booking.status} ke ${STATUS_LABEL[target] || target}.`);
    }
    booking.status = target;
    if (target === STATUS.CANCELLED) booking.approvalExpiresAt = null;
    booking.updatedAt = new Date().toISOString();

    notify(bookingAudience(booking).filter((e) => e !== user.email), {
      title: `Status pesanan: ${STATUS_LABEL[target]}`,
      body: `Pesanan #${booking.id} sekarang berstatus ${STATUS_LABEL[target]}.`,
      bookingId: booking.id,
    });
    broadcastBooking(booking);
    store.save();
    return { booking: serializeBooking(booking) };
  }, { auth: [] });

  route('POST', '/api/bookings/:id/location', ({ user, params, body }) => {
    const booking = getBookingFor(user, params.id);
    if (!TRACKABLE_STATUSES.has(booking.status)) throw new HttpError(409, 'Live location aktif setelah pesanan diterima.');
    if (!isLatLng(body)) throw new HttpError(400, 'Koordinat tidak valid.');
    const pos = { lat: body.lat, lng: body.lng, updatedAt: new Date().toISOString() };
    if (user.role === 'provider') booking.providerPos = pos;
    else booking.customerPos = pos;
    pushTo(bookingAudience(booking), 'location', {
      bookingId: booking.id,
      role: user.role,
      providerPos: booking.providerPos,
      customerPos: booking.customerPos,
    });
    store.save();
    return { ok: true };
  }, { auth: ['customer', 'provider'] });

  route('GET', '/api/bookings/:id/chat', ({ user, params }) => ({ chat: getBookingFor(user, params.id).chat }), { auth: [] });

  route('POST', '/api/bookings/:id/chat', ({ user, params, body }) => {
    const booking = getBookingFor(user, params.id);
    const text = cleanText(body.text, 1000);
    if (!text) throw new HttpError(400, 'Pesan tidak boleh kosong.');
    const append = (sender, senderName, msgText) => {
      const message = { id: nextId(booking.chat), sender, senderName, text: msgText, createdAt: new Date().toISOString() };
      booking.chat.push(message);
      if (booking.chat.length > MAX_CHAT_MESSAGES) booking.chat.splice(0, booking.chat.length - MAX_CHAT_MESSAGES);
      pushTo(bookingAudience(booking), 'chat', { bookingId: booking.id, message });
      return message;
    };
    const message = append(user.role, user.name, text);
    if (user.role === 'customer') {
      const answer = aiReply(text);
      if (answer) append('ai', 'AI Andallo', answer);
    }
    notify(bookingAudience(booking).filter((e) => e !== user.email && findUser(e)?.role !== 'admin'), {
      title: `Pesan baru dari ${user.name}`,
      body: text.length > 80 ? `${text.slice(0, 80)}…` : text,
      bookingId: booking.id,
    });
    store.save();
    return { status: 201, body: { message, chat: booking.chat } };
  }, { auth: [] });

  route('POST', '/api/bookings/:id/rating', ({ user, params, body }) => {
    const booking = getBookingFor(user, params.id);
    if (booking.status !== STATUS.DONE) throw new HttpError(409, 'Rating hanya bisa diberikan setelah pesanan selesai.');
    if (booking.rated) throw new HttpError(409, 'Pesanan ini sudah diberi rating.');
    const stars = Number(body.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, 'Rating harus 1 sampai 5.');
    const provider = findProvider(booking.providerId);
    booking.rated = true;
    booking.rating = { stars, comment: cleanText(body.comment, 500), createdAt: new Date().toISOString() };
    if (provider) {
      const total = provider.rating * provider.reviews + stars;
      provider.reviews += 1;
      provider.rating = Math.round((total / provider.reviews) * 10) / 10;
    }
    notify([...providerUsers(booking.providerId), ...admins()].map((u) => u.email), {
      title: 'Rating baru',
      body: `${user.name} memberi ${stars} bintang untuk pesanan #${booking.id}.`,
      bookingId: booking.id,
    });
    broadcastBooking(booking);
    store.save();
    return { booking: serializeBooking(booking), provider };
  }, { auth: ['customer'] });

  route('GET', '/api/notifications', ({ user }) => {
    const list = db().notifications.filter((n) => n.userEmail === user.email).slice(-50).reverse();
    return { notifications: list, unread: list.filter((n) => !n.read).length };
  }, { auth: [] });

  route('POST', '/api/notifications/read', ({ user }) => {
    for (const n of db().notifications) if (n.userEmail === user.email) n.read = true;
    store.save();
    return { ok: true };
  }, { auth: [] });

  route('GET', '/api/admin/overview', () => {
    const bookings = db().bookings;
    const byStatus = Object.fromEntries(Object.keys(STATUS_LABEL).map((s) => [s, 0]));
    for (const b of bookings) byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    return {
      stats: {
        users: db().users.length,
        providers: db().providers.length,
        bookings: bookings.length,
        revenue: bookings.filter((b) => b.status === STATUS.DONE).reduce((sum, b) => sum + b.total, 0),
        byStatus,
      },
      users: db().users.map(publicUser),
    };
  }, { auth: ['admin'] });

  function handleEvents(req, res, url) {
    const user = requireUser(req, url);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ email: user.email })}\n\n`);
    if (!sseClients.has(user.email)) sseClients.set(user.email, new Set());
    sseClients.get(user.email).add(res);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.get(user.email)?.delete(res);
    });
  }

  async function serveStatic(req, res, url) {
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      throw new HttpError(400, 'URL tidak valid.');
    }
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(403, 'Akses ditolak.');
    let target = filePath;
    try {
      const stat = await fsp.stat(target);
      if (!stat.isFile()) throw new Error('not a file');
    } catch {
      if (path.extname(pathname)) throw new HttpError(404, 'File tidak ditemukan.');
      target = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(target);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).pipe(res);
  }

  async function handler(req, res) {
    securityHeaders(res);
    const url = new URL(req.url, 'http://localhost');
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Metode tidak diizinkan.');
        return await serveStatic(req, res, url);
      }
      if (req.method === 'GET' && url.pathname === '/api/events') return handleEvents(req, res, url);

      for (const r of routes) {
        if (r.method !== req.method) continue;
        const match = url.pathname.match(r.regex);
        if (!match) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
        const user = r.auth ? requireUser(req, url, ...r.auth) : null;
        const body = req.method === 'POST' ? await readBody(req) : {};
        const result = await r.handler({ req, url, params, body, user });
        if (result && typeof result.status === 'number' && 'body' in result) return sendJson(res, result.status, result.body);
        return sendJson(res, 200, result);
      }
      throw new HttpError(404, 'Endpoint tidak ditemukan.');
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      console.error('[server] unexpected error:', err);
      return sendJson(res, 500, { error: 'Terjadi kesalahan pada server.' });
    }
  }

  const server = http.createServer(handler);
  const sweeper = setInterval(expirePendingBookings, 5000);
  sweeper.unref();
  expirePendingBookings();

  server.on('close', () => {
    clearInterval(sweeper);
    for (const set of sseClients.values()) for (const res of set) res.end();
  });

  return { server, store, expirePendingBookings };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  if (fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const { server } = createApp({ dbFile: process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : undefined });
  server.listen(port, host, () => {
    console.log(`Andallo berjalan di http://localhost:${port}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
