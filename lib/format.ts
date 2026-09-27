export const SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export const STATUS_LABEL: Record<string, string> = {
  WAITING_APPROVAL: 'Menunggu persetujuan',
  ACCEPTED: 'Diterima',
  REJECTED: 'Ditolak',
  EXPIRED: 'Kedaluwarsa',
  CONFIRMED: 'Dikonfirmasi',
  PROVIDER_ON_THE_WAY: 'Dalam perjalanan',
  ARRIVED: 'Tiba',
  ON_PROGRESS: 'Sedang dikerjakan',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  DISPUTED: 'Dalam sengketa',
  REFUNDED: 'Dana dikembalikan',
  DRAFT: 'Draf',
  SUBMITTED: 'Diajukan',
  UNDER_REVIEW: 'Sedang ditinjau',
  VERIFIED: 'Terverifikasi',
  SUSPENDED: 'Ditangguhkan',
  PENDING: 'Menunggu',
  OPEN: 'Terbuka',
  NEED_MORE_INFO: 'Perlu info tambahan',
  RESOLVED: 'Selesai ditangani',
  PAID: 'Lunas',
  UNPAID: 'Belum dibayar',
};

export const METHOD_LABEL: Record<string, string> = {
  HOME_SERVICE: 'Ke lokasi pelanggan',
  AT_PROVIDER: 'Di tempat mitra',
  BOTH: 'Keduanya',
};

export function rupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function formatDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00+07:00`) : value;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date);
}

export function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export function maskAccount(number: string) {
  const digits = number.replace(/\s/g, '');
  return `**** **** ${digits.slice(-4)}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function safeNext(value: string | undefined | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '';
  return value;
}
