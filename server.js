import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword, signSession, readSession, sha256, randomToken } from './lib/auth.js';
import { createStore, defaultDbFile } from './lib/store.js';
import { createData } from './lib/data.js';
import { DomainError } from './lib/errors.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const MAX_BODY_BYTES = 200 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const SESSION_SECRET_FALLBACK = 'andallo-demo-session-secret';

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

async function requestBody(req) {
  const already = req.body;
  if (already && typeof already === 'object' && !Buffer.isBuffer(already) && !Array.isArray(already)) return already;
  if (typeof already === 'string' && already.length) {
    try {
      const parsed = JSON.parse(already);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      throw new HttpError(400, 'Body harus berupa JSON yang valid.');
    }
  }
  if (Buffer.isBuffer(already) && already.length) {
    try {
      const parsed = JSON.parse(already.toString('utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      throw new HttpError(400, 'Body harus berupa JSON yang valid.');
    }
  }
  return readBody(req);
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

function queryNumber(value) {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export { defaultDbFile, hashPassword, verifyPassword };

export function createApp({ dbFile, env = process.env, background = true } = {}) {
  const store = createStore(dbFile || defaultDbFile(env));
  const data = createData(store.data);
  const secret = env.SESSION_SECRET || SESSION_SECRET_FALLBACK;
  const loginFailures = new Map();
  if (!env.SESSION_SECRET) console.warn('[andallo] SESSION_SECRET belum diisi. Token sesi memakai kunci demo.');

  const db = () => store.data;

  function tokenFrom(req, url) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) return header.slice(7);
    return url.searchParams.get('token');
  }

  function userFromToken(token) {
    const session = readSession(token, secret);
    if (!session) return null;
    if (db().revokedTokens?.includes(sha256(token))) return null;
    return data.findUserByEmail(session.email);
  }

  function resolveUser(req, url, auth) {
    if (!auth) return null;
    const user = userFromToken(tokenFrom(req, url));
    if (!user) {
      if (auth === 'optional') return null;
      throw new HttpError(401, 'Silakan masuk terlebih dahulu.');
    }
    if (auth === 'admin' && user.role !== 'admin') throw new HttpError(403, 'Akses ini khusus admin.');
    if (auth === 'customer' && user.role !== 'customer') throw new HttpError(403, 'Fitur ini khusus pelanggan.');
    return user;
  }

  function revoke(token) {
    if (!token) return;
    if (!Array.isArray(db().revokedTokens)) db().revokedTokens = [];
    const hash = sha256(token);
    if (!db().revokedTokens.includes(hash)) db().revokedTokens.push(hash);
    if (db().revokedTokens.length > 500) db().revokedTokens.splice(0, db().revokedTokens.length - 500);
    store.save();
  }

  const routes = [];
  const route = (method, pattern, handler, auth) => {
    const keys = [];
    const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, key) => (keys.push(key), '([^/]+)')) + '$');
    routes.push({ method, regex, keys, handler, auth });
  };

  route('GET', '/api/health', () => ({ ok: true, name: 'Andallo' }));
  route('GET', '/api/settings', () => ({ settings: data.getSettings() }));
  route('PUT', '/api/settings', ({ body }) => {
    const settings = data.updateSettings(body);
    store.save();
    return { settings };
  }, 'admin');

  route('POST', '/api/auth/register', ({ body }) => {
    if (body.confirmPassword != null && body.confirmPassword !== body.password) {
      throw new HttpError(400, 'Konfirmasi kata sandi tidak sama.');
    }
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new HttpError(400, 'Kata sandi minimal 8 karakter dan harus memuat huruf serta angka.');
    }
    const user = data.registerUser({ name: body.name, email: body.email, phone: body.phone, passwordHash: hashPassword(password) });
    store.save();
    return { status: 201, body: { token: signSession(user.email, secret, SESSION_TTL_MS), user } };
  });

  route('POST', '/api/auth/login', ({ req, body }) => {
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) throw new HttpError(400, 'Email dan kata sandi wajib diisi.');
    const key = `${req.socket?.remoteAddress || 'local'}|${email}`;
    const record = loginFailures.get(key);
    if (record && record.count >= LOGIN_MAX_FAILURES && Date.now() - record.first < LOGIN_WINDOW_MS) {
      throw new HttpError(429, 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.');
    }
    const user = data.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      const fresh = !record || Date.now() - record.first >= LOGIN_WINDOW_MS;
      loginFailures.set(key, fresh ? { count: 1, first: Date.now() } : { ...record, count: record.count + 1 });
      throw new HttpError(401, 'Email atau kata sandi salah.');
    }
    loginFailures.delete(key);
    return { token: signSession(user.email, secret, SESSION_TTL_MS), user: data.publicUser(user) };
  });

  route('POST', '/api/auth/logout', ({ req }) => {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) revoke(header.slice(7));
    return { ok: true };
  });

  route('POST', '/api/auth/forgot', ({ body }) => {
    const email = String(body.email || '').trim().toLowerCase();
    const user = data.findUserByEmail(email);
    const payload = { ok: true, message: 'Jika email terdaftar, tautan atur ulang kata sandi sudah dibuat.' };
    if (!user) return payload;
    const token = randomToken();
    db().resetTokens = (db().resetTokens || []).filter((item) => item.userId !== user.id);
    db().resetTokens.push({ tokenHash: sha256(token), userId: user.id, expiresAt: Date.now() + RESET_TTL_MS });
    store.save();
    if (env.EMAIL_DELIVERY !== 'external') payload.demoResetPath = `/#/atur-sandi?token=${token}`;
    return payload;
  });

  route('POST', '/api/auth/reset', ({ body }) => {
    const token = typeof body.token === 'string' ? body.token : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new HttpError(400, 'Kata sandi minimal 8 karakter dan harus memuat huruf serta angka.');
    }
    const row = (db().resetTokens || []).find((item) => item.tokenHash === sha256(token) && item.expiresAt > Date.now());
    if (!row) throw new HttpError(400, 'Tautan reset tidak berlaku atau sudah kedaluwarsa.');
    const user = data.findUserById(row.userId);
    if (!user) throw new HttpError(400, 'Akun tidak ditemukan.');
    user.passwordHash = hashPassword(password);
    db().resetTokens = db().resetTokens.filter((item) => item !== row);
    store.save();
    return { ok: true, message: 'Kata sandi berhasil diperbarui. Silakan masuk.' };
  });

  route('GET', '/api/me', ({ user }) => ({ user: data.publicUser(user) }), 'user');
  route('PUT', '/api/me', ({ user, body }) => {
    const profile = data.updateProfile(user, body);
    store.save();
    return { user: profile };
  }, 'user');
  route('PUT', '/api/me/password', ({ user, body }) => {
    const current = data.findUserById(user.id);
    if (!verifyPassword(body.currentPassword || '', current.passwordHash)) throw new HttpError(400, 'Kata sandi saat ini salah.');
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new HttpError(400, 'Kata sandi baru minimal 8 karakter dan harus memuat huruf serta angka.');
    }
    current.passwordHash = hashPassword(password);
    store.save();
    return { ok: true };
  }, 'user');

  route('GET', '/api/categories', () => ({ categories: data.listCategories() }));
  route('POST', '/api/categories', ({ body }) => {
    const category = data.createCategory(body);
    store.save();
    return { status: 201, body: { category } };
  }, 'admin');
  route('PUT', '/api/categories/:id', ({ params, body }) => {
    const category = data.updateCategory(params.id, body);
    store.save();
    return { category };
  }, 'admin');
  route('DELETE', '/api/categories/:id', ({ params }) => {
    const result = data.deleteCategory(params.id);
    store.save();
    return result;
  }, 'admin');

  route('GET', '/api/services', ({ url, req }) => {
    const user = resolveUser(req, url, 'optional');
    const manage = url.searchParams.get('kelola') === '1';
    if (manage && user?.role !== 'admin') throw new HttpError(403, 'Akses ini khusus admin.');
    const available = url.searchParams.get('available');
    return {
      services: data.listServices({
        q: url.searchParams.get('q') || '',
        category: url.searchParams.get('category') || '',
        city: url.searchParams.get('city') || '',
        minPrice: queryNumber(url.searchParams.get('minPrice')),
        maxPrice: queryNumber(url.searchParams.get('maxPrice')),
        minRating: queryNumber(url.searchParams.get('minRating')),
        available: available === '1' ? true : available === '0' ? false : undefined,
        featured: url.searchParams.get('featured') === '1' ? true : undefined,
        sort: url.searchParams.get('sort') || 'recommended',
        lat: queryNumber(url.searchParams.get('lat')),
        lng: queryNumber(url.searchParams.get('lng')),
        manage,
      }),
    };
  });
  route('GET', '/api/services/:id', ({ params, req, url }) => {
    const user = resolveUser(req, url, 'optional');
    const manage = url.searchParams.get('kelola') === '1' && user?.role === 'admin';
    return data.getService(params.id, { manage });
  });
  route('POST', '/api/services', ({ body }) => {
    const service = data.createService(body);
    store.save();
    return { status: 201, body: { service } };
  }, 'admin');
  route('PUT', '/api/services/:id', ({ params, body }) => {
    const service = data.updateService(params.id, body);
    store.save();
    return { service };
  }, 'admin');
  route('DELETE', '/api/services/:id', ({ params }) => {
    const result = data.deleteService(params.id);
    store.save();
    return result;
  }, 'admin');

  route('GET', '/api/providers', ({ url, req }) => {
    const user = resolveUser(req, url, 'optional');
    const manage = url.searchParams.get('kelola') === '1';
    if (manage && user?.role !== 'admin') throw new HttpError(403, 'Akses ini khusus admin.');
    return { providers: data.listProviders({ manage, q: url.searchParams.get('q') || '' }) };
  });
  route('GET', '/api/providers/:id', ({ params, req, url }) => {
    const user = resolveUser(req, url, 'optional');
    const manage = url.searchParams.get('kelola') === '1' && user?.role === 'admin';
    return data.getProvider(params.id, { manage });
  });
  route('POST', '/api/providers', ({ body }) => {
    const provider = data.createProvider(body);
    store.save();
    return { status: 201, body: { provider } };
  }, 'admin');
  route('PUT', '/api/providers/:id', ({ params, body }) => {
    const provider = data.updateProvider(params.id, body);
    store.save();
    return { provider };
  }, 'admin');
  route('DELETE', '/api/providers/:id', ({ params }) => {
    const result = data.deleteProvider(params.id);
    store.save();
    return result;
  }, 'admin');
  route('POST', '/api/providers/:id/portfolio', ({ params, body }) => {
    const item = data.addPortfolio(params.id, body);
    store.save();
    return { status: 201, body: { portfolio: item } };
  }, 'admin');
  route('DELETE', '/api/portfolio/:id', ({ params }) => {
    const result = data.deletePortfolio(params.id);
    store.save();
    return result;
  }, 'admin');

  route('GET', '/api/bookings', ({ user }) => ({ bookings: data.listBookings(user) }), 'user');
  route('POST', '/api/bookings', ({ user, body }) => {
    const booking = data.createBooking(user, body);
    store.save();
    return { status: 201, body: { booking } };
  }, 'customer');
  route('GET', '/api/bookings/:id', ({ user, params }) => ({ booking: data.getBooking(user, params.id) }), 'user');
  route('PUT', '/api/bookings/:id', ({ user, params, body }) => {
    const booking = data.updateBooking(user, params.id, body);
    store.save();
    return { booking };
  }, 'user');
  route('DELETE', '/api/bookings/:id', ({ user, params }) => {
    const result = data.deleteBooking(user, params.id);
    store.save();
    return result;
  }, 'admin');

  route('GET', '/api/reviews', ({ url, req }) => {
    const user = resolveUser(req, url, 'optional');
    if (url.searchParams.get('mine') === '1' && !user) throw new HttpError(401, 'Silakan masuk terlebih dahulu.');
    return {
      reviews: data.listReviews({
        serviceId: url.searchParams.get('serviceId') || '',
        providerId: url.searchParams.get('providerId') || '',
        mine: url.searchParams.get('mine') === '1',
        user,
      }),
    };
  });
  route('POST', '/api/reviews', ({ user, body }) => {
    const review = data.createReview(user, body);
    store.save();
    return { status: 201, body: { review } };
  }, 'customer');

  route('GET', '/api/saved', ({ user }) => ({ services: data.listSaved(user) }), 'customer');
  route('POST', '/api/saved', ({ user, body }) => {
    const result = data.saveService(user, body.serviceId);
    store.save();
    return result;
  }, 'customer');
  route('DELETE', '/api/saved/:serviceId', ({ user, params }) => {
    const result = data.unsaveService(user, params.serviceId);
    store.save();
    return result;
  }, 'customer');

  route('GET', '/api/admin/stats', () => ({ stats: data.stats() }), 'admin');
  route('GET', '/api/customers', () => ({ customers: data.listCustomers() }), 'admin');

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
      'Cache-Control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=86400',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).pipe(res);
  }

  async function handler(req, res) {
    securityHeaders(res);
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Metode tidak diizinkan.');
        return await serveStatic(req, res, url);
      }
      for (const entry of routes) {
        if (entry.method !== req.method) continue;
        const match = url.pathname.match(entry.regex);
        if (!match) continue;
        const params = Object.fromEntries(entry.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
        const user = entry.auth && entry.auth !== 'optional' ? resolveUser(req, url, entry.auth) : null;
        const body = req.method === 'POST' || req.method === 'PUT' ? await requestBody(req) : {};
        const result = await entry.handler({ req, url, params, body, user });
        if (result && typeof result.status === 'number' && 'body' in result) return sendJson(res, result.status, result.body);
        return sendJson(res, 200, result);
      }
      throw new HttpError(404, 'Endpoint tidak ditemukan.');
    } catch (err) {
      if (err instanceof HttpError || err instanceof DomainError) return sendJson(res, err.status, { error: err.message });
      console.error('[server] unexpected error:', err);
      return sendJson(res, 500, { error: 'Terjadi kesalahan pada server.' });
    }
  }

  const server = http.createServer(handler);

  function close() {
    return new Promise((resolve) => {
      server.close(() => store.flush().then(resolve));
      server.closeIdleConnections?.();
    });
  }

  return { server, handler, store, data, close };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  if (fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const app = createApp();
  app.server.listen(port, host, () => {
    console.log(`Andallo berjalan di http://localhost:${port}`);
  });
  const shutdown = () => {
    setTimeout(() => process.exit(0), 3000).unref();
    app.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
