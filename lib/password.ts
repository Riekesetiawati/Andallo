import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), 32, { N: Number(n), r: Number(r), p: Number(p) });
  const expected = Buffer.from(hashB64, 'base64');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
