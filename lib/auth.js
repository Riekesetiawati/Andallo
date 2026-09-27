import crypto from 'node:crypto';

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

export function signSession(email, secret, ttlMs) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + ttlMs })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readSession(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.email || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken() {
  return crypto.randomBytes(24).toString('base64url');
}
