import { z } from 'zod';

export const passwordSchema = z.string().min(8, 'Password minimal 8 karakter.').regex(/[A-Za-z]/, 'Password perlu huruf.').regex(/[0-9]/, 'Password perlu angka.');
export const loginSchema = z.object({
  email: z.string().email('Email tidak valid.'),
  password: z.string().min(7, 'Kata sandi wajib diisi.'),
});
export const registerSchema = z.object({
  name: z.string().trim().min(3, 'Nama minimal 3 karakter.'),
  email: z.string().email('Email tidak valid.'),
  phone: z.string().trim().min(10, 'Nomor telepon wajib diisi.').max(16),
  password: passwordSchema,
  confirm: z.string(),
  terms: z.literal(true, { error: 'Setujui syarat dan privasi terlebih dahulu.' }),
}).refine((value) => value.password === value.confirm, { path: ['confirm'], message: 'Konfirmasi kata sandi tidak sama.' });

export const bookingSchema = z.object({
  serviceId: z.string().uuid(),
  packageId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pilih tanggal.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Pilih jam.'),
  address: z.string().trim().min(5, 'Alamat layanan wajib diisi.'),
  notes: z.string().max(500).optional().default(''),
  method: z.enum(['HOME_SERVICE', 'AT_PROVIDER', 'BOTH']),
});

export const complaintSchema = z.object({
  bookingId: z.string().uuid(),
  category: z.string().min(3, 'Pilih kategori komplain.'),
  title: z.string().trim().min(4, 'Judul terlalu pendek.'),
  description: z.string().trim().min(10, 'Jelaskan komplain minimal 10 karakter.'),
  expected: z.string().trim().min(3, 'Tuliskan penyelesaian yang diharapkan.'),
});

export const reviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(5, 'Ulasan terlalu pendek.'),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(3, 'Nama jasa wajib diisi.'),
  categoryId: z.string().uuid('Pilih kategori.'),
  description: z.string().trim().min(10, 'Deskripsi minimal 10 karakter.'),
  duration: z.coerce.number().int().min(15, 'Durasi minimal 15 menit.'),
  method: z.enum(['HOME_SERVICE', 'AT_PROVIDER', 'BOTH']),
  active: z.boolean(),
});

export const packageSchema = z.object({
  serviceId: z.string().uuid(),
  name: z.string().trim().min(2),
  description: z.string().trim().default(''),
  price: z.coerce.number().int().min(0, 'Harga tidak boleh negatif.'),
  duration: z.coerce.number().int().min(15),
  active: z.boolean(),
}).refine((value) => value.price >= 0, { message: 'Harga tidak valid.' });

export function issue(error: { issues?: { message: string }[] }) {
  return error.issues?.[0]?.message || 'Data tidak valid.';
}
