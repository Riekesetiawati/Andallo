import { randomBytes, scryptSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const id = (group, n) => `${group}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const RIEKE = '11111111-1111-4111-8111-111111111111';
const MITRA = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';

const demoHash = hashPassword('demo123');
const extraHash = hashPassword('bukan-demo-rahasia');

const categories = [
  ['Perawatan', 'perawatan', 'scissors'],
  ['Kebersihan', 'kebersihan', 'sparkles'],
  ['Teknisi', 'teknisi', 'wrench'],
  ['Kreatif', 'kreatif', 'camera'],
  ['Kursus', 'kursus', 'book-open'],
  ['Otomotif', 'otomotif', 'car'],
  ['Kesehatan', 'kesehatan', 'heart-pulse'],
].map((row, index) => ({ id: id('50000000', index + 1), name: row[0], slug: row[1], icon: row[2] }));

const businesses = {
  Perawatan: [
    ['Bara Barbershop', 'Cukur Pria', 'Potong rambut pria di toko atau panggilan ke rumah. Termasuk konsultasi model.'],
    ['Studio Kinasih', 'Perawatan Rambut Wanita', 'Creambath, potong, dan cat rambut dengan konsultasi singkat.'],
    ['Pijat Senja', 'Pijat Refleksi Panggilan', 'Pijat seluruh badan untuk pegal setelah kerja. Terapis datang ke rumah.'],
    ['Nail Room Bekasi', 'Perawatan Kuku', 'Manicure dan pedicure dengan pilihan warna yang tersedia di studio.'],
    ['Grooming Pak Eko', 'Cukur dan Cuci Rambut', 'Cukur rapi plus cuci untuk acara keluarga atau harian.'],
  ],
  Kebersihan: [
    ['Bersih Rumah Ida', 'Pembersihan Rumah Menyeluruh', 'Bersihkan dapur, kamar mandi, lantai, dan debu yang biasa terlewat.'],
    ['Klinik Sofa', 'Cuci Sofa', 'Cuci sofa kain di rumah, termasuk pengeringan awal.'],
    ['Springbed Cerah', 'Cuci Springbed', 'Vacum, cuci noda, dan pengharum springbed.'],
    ['Deep Clean Depok', 'Deep Cleaning Kos', 'Pembersihan kos atau apartemen sebelum pindah atau setelah tamu.'],
    ['Halaman Rapi', 'Potong Rumput Halaman', 'Potong rumput dan rapikan pinggir taman kecil.'],
  ],
  Teknisi: [
    ['Dingin AC', 'Servis dan Cuci AC', 'Cuci AC dan cek kebocoran. Freon dibicarakan sebelum diisi.'],
    ['Listrik Aman', 'Perbaikan Listrik Rumah', 'Cek MCB, stopkontak panas, dan lampu yang mati.'],
    ['Ledeng Cepat', 'Perbaikan Pipa Bocor', 'Atasi kran bocor dan saluran mampet ringan.'],
    ['Mata CCTV', 'Pasang CCTV Rumah', 'Pasang 2–4 kamera untuk rumah tinggal, termasuk pengaturan aplikasi.'],
    ['Kulkas Hidup', 'Servis Kulkas', 'Cek tidak dingin, bersihkan kondensor, dan ganti karet pintu bila perlu.'],
  ],
  Kreatif: [
    ['Cahaya Senja Foto', 'Fotografi Keluarga', 'Sesi foto keluarga di rumah atau taman, file tanpa watermark.'],
    ['Rias Melati', 'Makeup Acara', 'Rias untuk lamaran atau kondangan, termasuk hairdo sederhana.'],
    ['Dekor Sederhana', 'Dekor Lamaran', 'Backdrop kain dan bunga untuk acara di rumah.'],
    ['Video Kisah', 'Video Dokumentasi', 'Video acara 1–2 jam dengan cuplikan singkat.'],
    ['Undangan Cetak', 'Desain Undangan', 'Desain undangan digital dan file siap cetak.'],
  ],
  Kursus: [
    ['Piano Rumah', 'Les Piano Privat', 'Les piano untuk pemula, guru datang ke rumah.'],
    ['English Tutors', 'Les Bahasa Inggris', 'Percakapan harian untuk pelajar dan dewasa.'],
    ['Dapur Belajar', 'Kursus Memasak', 'Masak menu rumahan untuk 2 orang di dapur Anda.'],
    ['Setir Tenang', 'Les Mengemudi', 'Latihan mengemudi di jalan lingkungan, mobil pengajar.'],
    ['Koding Anak', 'Kelas Koding Anak', 'Pengenalan logika dan proyek kecil untuk usia 8–14.'],
  ],
  Otomotif: [
    ['Bengkel Panggilan', 'Servis Mobil Rumah', 'Ganti oli dan cek rem di halaman rumah.'],
    ['Cuci Kilat', 'Cuci Mobil Panggilan', 'Cuci luar dalam untuk mobil kota.'],
    ['Salon Motor', 'Cuci dan Poles Motor', 'Cuci motor plus semir ban.'],
    ['Derek Ban', 'Tambal Ban Panggilan', 'Tambal ban tubeless di lokasi.'],
    ['Kaca Teduh', 'Pasang Kaca Film', 'Kaca film mobil dengan pilihan gelap sedang.'],
  ],
  Kesehatan: [
    ['Rawat Lansia', 'Pendamping Lansia', 'Menemani minum obat, jalan singkat, dan catat keluhan.'],
    ['Fisio Rumah', 'Fisioterapi Panggilan', 'Latihan gerak untuk nyeri punggung atau pasca cedera ringan.'],
    ['Bidan Homecare', 'Perawatan Ibu Nifas', 'Kunjungan perawatan luka dan edukasi menyusui.'],
    ['Cek Darah', 'Cek Kesehatan Dasar', 'Tensi, gula darah, dan catatan hasil.'],
    ['Terapi Napas', 'Latihan Pernapasan', 'Sesi latihan napas untuk pemulihan ringan.'],
  ],
};

const cities = [
  ['Bekasi', -6.2383, 106.9756],
  ['Jakarta', -6.2088, 106.8456],
  ['Tangerang', -6.1783, 106.6319],
  ['Depok', -6.4025, 106.7942],
  ['Jakarta', -6.2615, 106.7809],
  ['Bekasi', -6.274, 107.01],
  ['Tangerang', -6.225, 106.64],
];

const photos = [
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
];

const owners = ['Andi Pratama', 'Siti Rahma', 'Budi Santoso', 'Dewi Lestari', 'Agus Salim', 'Maya Putri', 'Rudi Hartono', 'Lia Kusuma', 'Fajar Nugroho', 'Nina Amelia'];
const reviewers = ['Dina Marlina', 'Budi Hartono', 'Sari Wulandari', 'Joko Susilo', 'Ayu Lestari', 'Rian Pratama', 'Mega Safitri', 'Hendra Wijaya', 'Putri Anindya', 'Yoga Mahendra', 'Lala Fitri', 'Omar Fadil'];
const comments = [
  'Datang tepat waktu dan hasilnya rapi.',
  'Komunikasinya jelas dari awal, harga sesuai yang tertulis.',
  'Peralatan dibawa sendiri dan area kerja ditinggal bersih.',
  'Cukup puas. Ada bagian kecil yang perlu dirapikan ulang, lalu langsung dibenahi.',
  'Pelayanan ramah. Saya akan pesan lagi untuk keluarga.',
  'Sesuai foto portofolio. Tidak ada biaya yang muncul tiba-tiba.',
];

const lines = [];
const sql = (text) => lines.push(text);
sql(`SELECT set_config('app.role', 'system', false);`);
sql(`SELECT set_config('app.user_id', '${ADMIN}', false);`);
sql(`TRUNCATE audit_logs, support_requests, comparisons, favorites, provider_locations, notifications, complaint_attachments, complaint_messages, complaints, review_images, reviews, chat_presence, chat_messages, chat_threads, payments, booking_cancellations, booking_status_history, bookings, provider_bank_accounts, provider_availability, portfolios, service_price_packages, services, provider_verifications, highlights, homepage_carousels, provider_profiles, phone_otps, email_tokens, sessions, login_attempts, profiles, categories RESTART IDENTITY CASCADE;`);

for (const category of categories) {
  sql(`INSERT INTO categories (id, name, slug, icon, sort_order, is_active) VALUES (${q(category.id)}, ${q(category.name)}, ${q(category.slug)}, ${q(category.icon)}, ${categories.indexOf(category) + 1}, true);`);
}

function profile(userId, email, name, phone, role, hash) {
  sql(`INSERT INTO profiles (id, email, phone, password_hash, role, full_name, email_verified_at, phone_verified_at, terms_accepted_at) VALUES (${q(userId)}, ${q(email)}, ${q(phone)}, ${q(hash)}, ${q(role)}, ${q(name)}, now(), now(), now());`);
}

profile(RIEKE, 'rieke@andallo.com', 'Rieke Setiawati', '081234567890', 'customer', demoHash);
profile(ADMIN, 'admin@andallo.com', 'Admin Andallo', '081200000001', 'admin', demoHash);
profile(MITRA, 'mitra@andallo.com', 'Bara Wijaya', '081300000001', 'provider', demoHash);

reviewers.forEach((name, index) => {
  profile(id('10000000', index + 1), `ulasan${index + 1}@seed.andallo.id`, name, `0818${String(10000000 + index)}`, 'customer', extraHash);
});

let providerIndex = 0;
const providerRows = [];
for (const category of categories) {
  businesses[category.name].forEach((item, localIndex) => {
    const [business, serviceName, description] = item;
    const isMitra = providerIndex === 0;
    const userId = isMitra ? MITRA : id('11000000', providerIndex);
    const providerId = isMitra ? '44444444-4444-4444-8444-444444444444' : id('20000000', providerIndex + 1);
    const serviceId = id('30000000', providerIndex + 1);
    const city = cities[providerIndex % cities.length];
    const lat = city[1] + ((providerIndex % 5) - 2) * 0.012;
    const lng = city[2] + ((providerIndex % 4) - 1) * 0.015;
    const method = ['HOME_SERVICE', 'AT_PROVIDER', 'BOTH'][providerIndex % 3];
    const base = 50000 + providerIndex * 15000;
    const slug = business.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const photo = photos[providerIndex % photos.length];
    const photo2 = photos[(providerIndex + 3) % photos.length];
    if (!isMitra) {
      profile(userId, `mitra${providerIndex}@seed.andallo.id`, owners[providerIndex % owners.length], `0817${String(20000000 + providerIndex)}`, 'provider', extraHash);
    }
    sql(`INSERT INTO provider_profiles (id, user_id, slug, business_name, description, category_id, address, city, lat, lng, service_radius_km, cover_url, phone, business_email, service_method, status, operating_hours, verified_at) VALUES (
      ${q(providerId)}, ${q(userId)}, ${q(slug)}, ${q(business)}, ${q(description + ' Melayani area ' + city[0] + ' dan sekitarnya.')}, ${q(category.id)}, ${q('Area ' + city[0])}, ${q(city[0])}, ${lat}, ${lng}, ${8 + (providerIndex % 6)}, ${q(photo)}, ${q('0813' + String(3000000 + providerIndex))}, ${q(slug + '@andallo.id')}, ${q(method)}, 'VERIFIED', '{"mon":["08:00","17:00"],"tue":["08:00","17:00"],"wed":["08:00","17:00"],"thu":["08:00","17:00"],"fri":["08:00","17:00"],"sat":["08:00","15:00"],"sun":["09:00","13:00"]}'::jsonb, now());`);
    sql(`INSERT INTO provider_verifications (provider_id, status, note, reviewed_by) VALUES (${q(providerId)}, 'VERIFIED', 'Diverifikasi untuk data demo.', ${q(ADMIN)});`);
    sql(`INSERT INTO services (id, provider_id, category_id, name, slug, description, min_price, max_price, duration_min, service_method, image_url, is_active) VALUES (${q(serviceId)}, ${q(providerId)}, ${q(category.id)}, ${q(serviceName)}, ${q(slug + '-jasa')}, ${q(description)}, ${base}, ${base + 70000}, ${60 + (providerIndex % 3) * 30}, ${q(method)}, ${q(photo)}, true);`);
    const pkg1 = id('40000000', providerIndex * 2 + 1);
    const pkg2 = id('40000000', providerIndex * 2 + 2);
    sql(`INSERT INTO service_price_packages (id, service_id, name, description, price, duration_min, sort_order) VALUES (${q(pkg1)}, ${q(serviceId)}, 'Paket Dasar', 'Layanan inti sesuai deskripsi.', ${base}, 60, 1);`);
    sql(`INSERT INTO service_price_packages (id, service_id, name, description, price, duration_min, sort_order) VALUES (${q(pkg2)}, ${q(serviceId)}, 'Paket Lengkap', 'Layanan inti ditambah pengerjaan tambahan.', ${base + 35000}, 90, 2);`);
    sql(`INSERT INTO portfolios (provider_id, service_id, image_url, caption, sort_order) VALUES (${q(providerId)}, ${q(serviceId)}, ${q(photo)}, ${q('Hasil ' + serviceName + ' di ' + city[0])}, 1);`);
    sql(`INSERT INTO portfolios (provider_id, service_id, image_url, caption, sort_order) VALUES (${q(providerId)}, ${q(serviceId)}, ${q(photo2)}, ${q('Detail pekerjaan ' + business)}, 2);`);
    for (let day = 0; day <= 6; day += 1) {
      const start = day === 0 ? '09:00' : '08:00';
      const end = day === 0 ? '13:00' : day === 6 ? '15:00' : '17:00';
      sql(`INSERT INTO provider_availability (provider_id, weekday, start_time, end_time) VALUES (${q(providerId)}, ${day}, ${q(start)}, ${q(end)});`);
    }
    const reviewCount = 4 + (providerIndex % 9);
    for (let r = 0; r < reviewCount; r += 1) {
      const customerId = id('10000000', (r % reviewers.length) + 1);
      const bookingId = id('60000000', providerIndex * 20 + r + 1);
      const rating = [5, 5, 4, 5, 4, 3, 5][ (providerIndex + r) % 7 ];
      const day = String((r % 27) + 1).padStart(2, '0');
      sql(`INSERT INTO bookings (id, code, customer_id, provider_id, service_id, package_id, booking_date, time_slot, status, address, notes, service_method, approval_expires_at) VALUES (${q(bookingId)}, ${q('ADL-S' + String(providerIndex * 20 + r + 1).padStart(4, '0'))}, ${q(customerId)}, ${q(providerId)}, ${q(serviceId)}, ${q(r % 2 ? pkg2 : pkg1)}, DATE '2026-08-${day}', '10:00', 'COMPLETED', ${q('Alamat pelanggan di ' + city[0])}, '', ${q(method)}, now());`);
      sql(`INSERT INTO reviews (booking_id, customer_id, provider_id, service_id, rating, comment) VALUES (${q(bookingId)}, ${q(customerId)}, ${q(providerId)}, ${q(serviceId)}, ${rating}, ${q(comments[(providerIndex + r) % comments.length])});`);
    }
    providerRows.push({ providerId, serviceId, pkg1, business, serviceName, city: city[0], categoryId: category.id, localIndex });
    providerIndex += 1;
  });
}

const mitra = providerRows[0];
const other = providerRows[4];
sql(`INSERT INTO bookings (id, code, customer_id, provider_id, service_id, package_id, booking_date, time_slot, status, address, notes, service_method, approval_expires_at) VALUES ('70000000-0000-4000-8000-000000000001', 'ADL-9001', ${q(RIEKE)}, ${q(mitra.providerId)}, ${q(mitra.serviceId)}, ${q(mitra.pkg1)}, (now() AT TIME ZONE 'Asia/Jakarta')::date + 1, '09:00', 'WAITING_APPROVAL', 'Jalan Mawar No. 8, Bekasi Utara', 'Mohon datang 10 menit lebih awal.', 'AT_PROVIDER', now() + interval '2 minutes');`);
sql(`INSERT INTO bookings (id, code, customer_id, provider_id, service_id, package_id, booking_date, time_slot, status, address, notes, service_method, approval_expires_at) VALUES ('70000000-0000-4000-8000-000000000002', 'ADL-9002', ${q(RIEKE)}, ${q(other.providerId)}, ${q(other.serviceId)}, ${q(other.pkg1)}, DATE '2026-08-12', '11:00', 'COMPLETED', 'Jalan Kenanga No. 3, Bekasi', 'Sudah selesai, belum diulas.', 'HOME_SERVICE', now());`);
sql(`INSERT INTO favorites (customer_id, provider_id) VALUES (${q(RIEKE)}, ${q(mitra.providerId)}), (${q(RIEKE)}, ${q(other.providerId)});`);
sql(`INSERT INTO provider_bank_accounts (provider_id, bank_name, account_number, account_holder, status) VALUES (${q(mitra.providerId)}, 'BCA', '1234567890', 'Bara Wijaya', 'PENDING');`);

sql(`INSERT INTO highlights (provider_id, headline, subtitle, banner_url, cta_label, sort_order, is_active) VALUES
  (${q(mitra.providerId)}, 'Cukur rapi di Bekasi', 'Bara Barbershop, mitra terverifikasi Andallo.', ${q(photos[0])}, 'Lihat mitra', 1, true),
  (${q(providerRows[5].providerId)}, 'Rumah bersih sebelum tamu datang', 'Jadwal harian masih tersedia.', ${q(photos[3])}, 'Pesan jasa', 2, true),
  (${q(providerRows[10].providerId)}, 'AC dingin lagi hari ini', 'Teknisi menjelaskan biaya sebelum bekerja.', ${q(photos[4])}, 'Cek jadwal', 3, true);`);
sql(`INSERT INTO homepage_carousels (title, subtitle, image_url, link, provider_id, sort_order, is_active) VALUES
  ('Ada yang perlu dibantu?', 'Bandingkan harga, rating, dan jarak dalam satu halaman.', ${q(photos[5])}, '/jasa', NULL, 1, true),
  ('Mitra terverifikasi', 'Penyedia baru tampil setelah lolos peninjauan admin.', ${q(photos[1])}, '/jasa?category=${categories[0].slug}', ${q(mitra.providerId)}, 2, true),
  ('Pesan sesuai jadwal Anda', 'Pilih tanggal dan jam. Mitra menjawab dalam 2 menit.', ${q(photos[6])}, '/bantuan', NULL, 3, true);`);

sql(`INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, after_data) VALUES (${q(ADMIN)}, 'seed', 'system', NULL, '{"note":"Data demo development"}'::jsonb);`);

const file = lines.join('\n') + '\n';
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), file);
execFileSync('sudo', ['-u', 'postgres', 'psql', '-d', 'andallo', '-v', 'ON_ERROR_STOP=1', '-f', new URL('../supabase/seed.sql', import.meta.url).pathname], { stdio: 'inherit' });
console.log(`seeded ${providerIndex} providers`);
