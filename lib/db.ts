import { Pool, type PoolClient } from 'pg';

export type Role = 'anon' | 'customer' | 'provider' | 'admin' | 'system';

export type Actor = {
  id: string;
  role: Exclude<Role, 'anon' | 'system'>;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
};

declare global {
  var __andalloPool: Pool | undefined;
}

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum diisi.');
  if (!global.__andalloPool) {
    global.__andalloPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return global.__andalloPool;
}

export async function withActor<T>(actor: { id?: string; role: Role }, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await getPool().connect();
  try {
    await db.query('BEGIN');
    await db.query(`SELECT set_config('app.user_id', $1, true), set_config('app.role', $2, true)`, [actor.id ?? '', actor.role]);
    await db.query('SELECT expire_bookings()');
    const result = await fn(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

export function dbErrorMessage(error: unknown) {
  const err = error as { code?: string; constraint?: string; message?: string };
  if (err?.code === '23505') {
    if (err.constraint?.includes('slot')) return 'Jadwal tersebut baru saja terisi. Silakan pilih waktu lain.';
    if (err.constraint?.includes('favorites')) return 'Penyedia ini sudah ada di favorit.';
    if (err.constraint?.includes('reviews')) return 'Pesanan ini sudah diulas.';
    if (err.constraint?.includes('email')) return 'Email sudah terdaftar.';
    if (err.constraint?.includes('phone')) return 'Nomor telepon sudah terdaftar.';
    return 'Data tersebut sudah ada.';
  }
  const text = err?.message || '';
  if (/Maksimal 3|kategori yang sama|tidak diizinkan|tidak ditemukan|Verifikasi|kedaluwarsa|Pelacakan|sudah lewat|Paket|Mitra|Ulasan|Jadwal|wajib|Password|Email|telepon|tidak aktif|habis/.test(text)) {
    return text.replace(/^error:\s*/i, '');
  }
  console.error(error);
  return 'Terjadi kesalahan saat memproses permintaan.';
}
