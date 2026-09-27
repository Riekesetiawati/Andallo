import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { withActor, type Actor } from './db';
import { readSession, signSession } from './token';

const COOKIE = 'andallo_session';

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function getActor(): Promise<Actor | null> {
  const jar = await cookies();
  const parsed = await readSession(jar.get(COOKIE)?.value);
  if (!parsed) return null;
  return withActor({ role: 'system' }, async (db) => {
    const { rows } = await db.query(
      `SELECT id, role, full_name, email, phone, avatar_url, email_verified_at, phone_verified_at
       FROM profiles p
       WHERE p.id = $1
         AND EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = p.id AND s.token_hash = $2 AND s.expires_at > now())`,
      [parsed.uid, tokenHash(parsed.token)],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      role: row.role,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      emailVerifiedAt: row.email_verified_at,
      phoneVerifiedAt: row.phone_verified_at,
    } satisfies Actor;
  });
}

export async function startSession(user: { id: string; role: Actor['role'] }, remember: boolean) {
  const token = randomBytes(32).toString('base64url');
  const days = remember ? 30 : 1;
  const exp = Date.now() + days * 86400000;
  await withActor({ role: 'system' }, (db) =>
    db.query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, to_timestamp($3 / 1000.0))`, [user.id, tokenHash(token), exp]),
  );
  const value = await signSession({ uid: user.id, role: user.role, exp, token });
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: days * 86400,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const parsed = await readSession(jar.get(COOKIE)?.value);
  if (parsed) {
    await withActor({ role: 'system' }, (db) => db.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash(parsed.token)]));
  }
  jar.delete(COOKIE);
}
