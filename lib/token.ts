const encoder = new TextEncoder();

function encode(value: string) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decode(value: string) {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  return atob(value.replaceAll('-', '+').replaceAll('_', '/') + pad);
}

async function hmac(payload: string) {
  const secret = process.env.SESSION_SECRET || 'andallo-dev-session-secret';
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return encode(String.fromCharCode(...new Uint8Array(sig)));
}

export type SessionPayload = { uid: string; role: 'customer' | 'provider' | 'admin'; exp: number; token: string };

export async function signSession(data: SessionPayload) {
  const payload = encode(JSON.stringify(data));
  return `${payload}.${await hmac(payload)}`;
}

export async function readSession(cookie: string | undefined | null): Promise<SessionPayload | null> {
  if (!cookie) return null;
  const [payload, sig] = cookie.split('.');
  if (!payload || !sig) return null;
  const expected = await hmac(payload);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const data = JSON.parse(decode(payload)) as SessionPayload;
    if (!data.exp || data.exp < Date.now()) return null;
    if (!data.uid || !data.token || !data.role) return null;
    return data;
  } catch {
    return null;
  }
}
