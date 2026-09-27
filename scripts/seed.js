import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../lib/auth.js';
import { CITIES } from '../lib/data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const passwordHash = hashPassword('Demo1234');
const fee = 5;
const quote = (price) => ({ price, platformFee: Math.round((price * fee) / 100), platformFeePercent: fee, total: price + Math.round((price * fee) / 100) });

const img = {
  wedding: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80',
  wedding2: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=80',
  wedding3: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1400&q=80',
  makeup: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=80',
  makeup2: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1400&q=80',
  makeup3: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1400&q=80',
  clean: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80',
  clean2: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1400&q=80',
  food: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1400&q=80',
  food2: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80',
  food3: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1400&q=80',
  ac: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1400&q=80',
  tools: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1400&q=80',
  event: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80',
  event2: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1400&q=80',
  salon: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80',
  salon2: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1400&q=80',
  car: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1400&q=80',
  car2: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80',
  home: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80',
  plumb: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1400&q=80',
  portrait: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
};

const categories = [
  { id: 'cat_foto', name: 'Fotografi', slug: 'fotografi' },
  { id: 'cat_makeup', name: 'Makeup Artist', slug: 'makeup-artist' },
  { id: 'cat_katering', name: 'Katering', slug: 'katering' },
  { id: 'cat_bersih', name: 'Kebersihan', slug: 'kebersihan' },
  { id: 'cat_perbaikan', name: 'Perbaikan', slug: 'perbaikan' },
  { id: 'cat_event', name: 'Event Organizer', slug: 'event-organizer' },
  { id: 'cat_cantik', name: 'Kecantikan', slug: 'kecantikan' },
  { id: 'cat_otomotif', name: 'Otomotif', slug: 'otomotif' },
  { id: 'cat_rumah', name: 'Jasa Rumah', slug: 'jasa-rumah' },
];

function provider(row) {
  const city = CITIES[row.city];
  return { verified: true, active: true, createdAt: '2026-01-10T02:00:00.000Z', lat: city.lat, lng: city.lng, ...row };
}

const providers = [
  provider({ id: 'prv_cahaya', name: 'Maya Putri', businessName: 'Cahaya Senja Studio', image: img.portrait, description: 'Studio foto berbasis di Tangerang yang fokus pada pernikahan dan keluarga. Setiap jadwal dikerjakan oleh fotografer tetap, bukan freelancer dadakan.', phone: '081210001001', email: 'halo@cahayasenja.id', city: 'Tangerang', location: 'Karawaci, Tangerang', categoryId: 'cat_foto' }),
  provider({ id: 'prv_kinasih', name: 'Kinasih Amalia', businessName: 'Rias Kinasih', image: img.makeup, description: 'Makeup artist pengantin dan acara dengan produk kulit sensitif. Konsultasi wajah dilakukan sebelum hari-H.', phone: '081310001002', email: 'ria@kinasih.id', city: 'Jakarta', location: 'Kemang, Jakarta Selatan', categoryId: 'cat_makeup' }),
  provider({ id: 'prv_dapur', name: 'Arman Yusuf', businessName: 'Dapur Rumah Kita', image: img.food2, description: 'Katering rumahan untuk syukuran, lamaran, dan resepsi kecil. Menu bisa dicoba sebelum hari acara.', phone: '081510001003', email: 'pesan@dapurkita.id', city: 'Bandung', location: 'Dago, Bandung', categoryId: 'cat_katering' }),
  provider({ id: 'prv_bersih', name: 'Sinta Dewi', businessName: 'BersihHati Home', image: img.clean, description: 'Tim kebersihan rumah dua sampai empat orang. Peralatan dan cairan dibawa sendiri, tanpa biaya tersembunyi.', phone: '081610001004', email: 'halo@bersihhati.id', city: 'Bekasi', location: 'Bekasi Utara', categoryId: 'cat_bersih' }),
  provider({ id: 'prv_dingin', name: 'Reza Pratama', businessName: 'DinginNyaman Teknik', image: img.tools, description: 'Teknisi AC panggilan untuk rumah dan ruko. Diagnosa dijelaskan sebelum pengerjaan dimulai.', phone: '081710001005', email: 'servis@dinginnyaman.id', city: 'Depok', location: 'Margonda, Depok', categoryId: 'cat_perbaikan' }),
  provider({ id: 'prv_ruang', name: 'Nadia Kusuma', businessName: 'Ruang Acara', image: img.event, description: 'Perencana acara untuk lamaran, ulang tahun, dan gathering kantor. Rundown dan vendor dikunci dalam satu proposal.', phone: '081810001006', email: 'halo@ruangacara.id', city: 'Jakarta', location: 'Menteng, Jakarta Pusat', categoryId: 'cat_event' }),
  provider({ id: 'prv_salon', name: 'Lala Wirawan', businessName: 'Salon Pelukan', image: img.salon, description: 'Perawatan rambut dan kulit di studio Bandung. Booking jam datang, jadi tidak antre panjang.', phone: '081910001007', email: 'halo@salonpelukan.id', city: 'Bandung', location: 'Setiabudi, Bandung', categoryId: 'cat_cantik' }),
  provider({ id: 'prv_bengkel', name: 'Agus Salim', businessName: 'Bengkel Panggil', image: img.car, description: 'Servis ringan mobil di rumah: oli, aki, dan pengecekan rem. Cocok kalau mobil tidak sempat dibawa ke bengkel.', phone: '081110001008', email: 'halo@bengkelpanggil.id', city: 'Bekasi', location: 'Jatiasih, Bekasi', categoryId: 'cat_otomotif' }),
  provider({ id: 'prv_tukang', name: 'Hendra Wijaya', businessName: 'TukangRumah', image: img.plumb, description: 'Perbaikan kecil rumah: kran, pintu, dan instalasi lampu. Datang dengan perkakas sendiri.', phone: '081220001009', email: 'halo@tukangrumah.id', city: 'Tangerang', location: 'BSD, Tangerang Selatan', categoryId: 'cat_rumah' }),
];

function service(row) {
  const city = CITIES[row.city];
  return { available: true, active: true, featured: false, createdAt: '2026-02-01T02:00:00.000Z', updatedAt: '2026-08-01T02:00:00.000Z', lat: city.lat, lng: city.lng, ...row };
}

const services = [
  service({ id: 'svc_foto', providerId: 'prv_cahaya', categoryId: 'cat_foto', name: 'Fotografi Pernikahan Premium', city: 'Tangerang', location: 'Melayani Tangerang, Jakarta, dan Depok', featured: true, images: [img.wedding, img.wedding2, img.wedding3], description: 'Dokumentasi pernikahan dari akad sampai resepsi. File asli diserahkan tanpa watermark, plus galeri online untuk keluarga.', packages: [
    { id: 'pkg_foto_akad', name: 'Akad saja', description: '6 jam, 1 fotografer, 150 foto edit.', price: 4500000, duration: '6 jam' },
    { id: 'pkg_foto_penuh', name: 'Akad dan resepsi', description: '12 jam, 2 fotografer, album cetak 20 halaman.', price: 7500000, duration: '12 jam' },
  ] }),
  service({ id: 'svc_makeup', providerId: 'prv_kinasih', categoryId: 'cat_makeup', name: 'Paket Makeup Pengantin', city: 'Jakarta', location: 'Datang ke lokasi, area Jabodetabek', featured: true, images: [img.makeup, img.makeup2, img.makeup3], description: 'Rias pengantin dengan uji coba sebelum hari-H. Termasuk hairdo dan sentuhan untuk ibu pengantin.', packages: [
    { id: 'pkg_makeup_pagi', name: 'Akad pagi', description: 'Makeup, hairdo, dan satu retouch.', price: 1500000, duration: '3 jam' },
    { id: 'pkg_makeup_seharian', name: 'Seharian', description: 'Uji coba, akad, resepsi, dan asisten rias.', price: 2800000, duration: 'Seharian' },
  ] }),
  service({ id: 'svc_katering', providerId: 'prv_dapur', categoryId: 'cat_katering', name: 'Paket Katering Pernikahan', city: 'Bandung', location: 'Bandung dan Cimahi', featured: true, images: [img.food, img.food2, img.food3], description: 'Prasmanan untuk resepsi intim. Menu bisa diganti sesuai pantangan, dan sisa makanan dikemas rapi.', packages: [
    { id: 'pkg_katering_50', name: '50 porsi', description: '4 lauk, nasi, sayur, dan buah.', price: 6500000, duration: '1 hari acara' },
    { id: 'pkg_katering_100', name: '100 porsi', description: '6 lauk, dessert, dan pramusaji.', price: 12000000, duration: '1 hari acara' },
  ] }),
  service({ id: 'svc_bersih', providerId: 'prv_bersih', categoryId: 'cat_bersih', name: 'Pembersihan Rumah Menyeluruh', city: 'Bekasi', location: 'Bekasi dan Jakarta Timur', featured: true, images: [img.clean, img.clean2], description: 'Pembersihan dapur, kamar mandi, lantai, dan debu di area yang biasa terlewat. Cocok sebelum tamu datang atau setelah renovasi ringan.', packages: [
    { id: 'pkg_bersih_2', name: 'Rumah 2 kamar', description: '2 petugas, sekitar 3 jam.', price: 350000, duration: '3 jam' },
    { id: 'pkg_bersih_4', name: 'Rumah 4 kamar', description: '3 petugas, termasuk bagian dalam lemari.', price: 650000, duration: '5 jam' },
  ] }),
  service({ id: 'svc_ac', providerId: 'prv_dingin', categoryId: 'cat_perbaikan', name: 'Servis dan Perbaikan AC', city: 'Depok', location: 'Depok, Margonda, dan sekitarnya', featured: true, images: [img.tools, img.ac], description: 'Cuci AC, isi freon jika kurang, dan pengecekan kebocoran. Harga suku cadang diinfokan sebelum dipasang.', packages: [
    { id: 'pkg_ac_cuci', name: 'Cuci 1 unit', description: 'Cuci standar split 0,5–1 PK.', price: 150000, duration: '1 jam' },
    { id: 'pkg_ac_overhaul', name: 'Overhaul', description: 'Bongkar unit indoor dan cek kelistrikan.', price: 350000, duration: '2 jam' },
  ] }),
  service({ id: 'svc_event', providerId: 'prv_ruang', categoryId: 'cat_event', name: 'Pengelolaan Acara Lamaran', city: 'Jakarta', location: 'Jakarta dan Tangerang', images: [img.event, img.event2], description: 'Rundown, dekor sederhana, dan koordinasi vendor di hari acara. Anda tetap bisa memilih vendor sendiri.', packages: [
    { id: 'pkg_event_inti', name: 'Koordinasi hari-H', description: '1 koordinator, 6 jam.', price: 2500000, duration: '6 jam' },
    { id: 'pkg_event_penuh', name: 'Siap acara', description: 'Konsep, vendor, dan 2 kru lapangan.', price: 8000000, duration: 'Persiapan 2 minggu' },
  ] }),
  service({ id: 'svc_salon', providerId: 'prv_salon', categoryId: 'cat_cantik', name: 'Perawatan Rambut dan Kulit', city: 'Bandung', location: 'Studio di Setiabudi, Bandung', images: [img.salon, img.salon2], description: 'Potong, creambath, dan facial dasar. Konsultasi singkat sebelum treatment supaya hasilnya sesuai jenis rambut.', packages: [
    { id: 'pkg_salon_rambut', name: 'Creambath dan potong', description: 'Termasuk cuci dan blow.', price: 180000, duration: '90 menit' },
    { id: 'pkg_salon_lengkap', name: 'Rambut dan facial', description: 'Creambath, potong, dan facial dasar.', price: 320000, duration: '2,5 jam' },
  ] }),
  service({ id: 'svc_mobil', providerId: 'prv_bengkel', categoryId: 'cat_otomotif', name: 'Servis Mobil Panggilan', city: 'Bekasi', location: 'Bekasi dan Cibubur', images: [img.car, img.car2], description: 'Ganti oli, cek aki, dan inspeksi rem di rumah. Oli dibawa sesuai spesifikasi mobil, atau memakai oli yang Anda sediakan.', packages: [
    { id: 'pkg_mobil_oli', name: 'Ganti oli', description: 'Jasa pengerjaan, oli dihitung terpisah.', price: 200000, duration: '45 menit' },
    { id: 'pkg_mobil_inspeksi', name: 'Inspeksi 20 titik', description: 'Laporan kondisi singkat lewat catatan pesanan.', price: 275000, duration: '1 jam' },
  ] }),
  service({ id: 'svc_rumah', providerId: 'prv_tukang', categoryId: 'cat_rumah', name: 'Perbaikan Rumah Panggilan', city: 'Tangerang', location: 'Tangerang dan BSD', images: [img.plumb, img.home], description: 'Perbaikan kran bocor, engsel pintu, dan penggantian lampu. Material besar dibicarakan dulu sebelum dibeli.', packages: [
    { id: 'pkg_rumah_jam', name: '1 jam kunjungan', description: 'Satu titik perbaikan kecil.', price: 175000, duration: '1 jam' },
    { id: 'pkg_rumah_3', name: '3 jam', description: 'Beberapa titik di rumah yang sama.', price: 400000, duration: '3 jam' },
  ] }),
];

const portfolios = [
  { id: 'prf_1', providerId: 'prv_cahaya', serviceId: 'svc_foto', title: 'Akad di rumah keluarga', description: 'Dokumentasi akad 80 tamu dengan cahaya sore.', category: 'Fotografi', date: '2026-06-14', image: img.wedding },
  { id: 'prf_2', providerId: 'prv_cahaya', serviceId: 'svc_foto', title: 'Resepsi taman', description: 'Dua fotografer, galeri selesai dalam lima hari.', category: 'Fotografi', date: '2026-07-02', image: img.wedding2 },
  { id: 'prf_3', providerId: 'prv_kinasih', serviceId: 'svc_makeup', title: 'Rias akad hijab', description: 'Makeup tahan hingga resepsi siang.', category: 'Makeup Artist', date: '2026-05-20', image: img.makeup },
  { id: 'prf_4', providerId: 'prv_kinasih', serviceId: 'svc_makeup', title: 'Uji coba keluarga', description: 'Satu sesi uji coba untuk pengantin dan ibu.', category: 'Makeup Artist', date: '2026-04-11', image: img.makeup2 },
  { id: 'prf_5', providerId: 'prv_dapur', serviceId: 'svc_katering', title: 'Prasmanan 80 porsi', description: 'Menu Sunda untuk lamaran di Dago.', category: 'Katering', date: '2026-03-18', image: img.food },
  { id: 'prf_6', providerId: 'prv_dapur', serviceId: 'svc_katering', title: 'Dessert table kecil', description: 'Tambahan paket resepsi intim.', category: 'Katering', date: '2026-08-09', image: img.food3 },
  { id: 'prf_7', providerId: 'prv_bersih', serviceId: 'svc_bersih', title: 'Rumah setelah renovasi', description: 'Pembersihan debu halus di tiga lantai.', category: 'Kebersihan', date: '2026-07-21', image: img.clean },
  { id: 'prf_8', providerId: 'prv_dingin', serviceId: 'svc_ac', title: 'Cuci AC kantor kecil', description: 'Empat unit split selesai setengah hari.', category: 'Perbaikan', date: '2026-06-30', image: img.tools },
  { id: 'prf_9', providerId: 'prv_ruang', serviceId: 'svc_event', title: 'Lamaran di rumah', description: 'Rundown 4 jam dan koordinasi dekor.', category: 'Event Organizer', date: '2026-05-02', image: img.event },
  { id: 'prf_10', providerId: 'prv_salon', serviceId: 'svc_salon', title: 'Creambath warna natural', description: 'Perawatan rambut kering sebelum lebaran.', category: 'Kecantikan', date: '2026-03-28', image: img.salon },
  { id: 'prf_11', providerId: 'prv_bengkel', serviceId: 'svc_mobil', title: 'Ganti oli di carport', description: 'Servis pagi sebelum berangkat kerja.', category: 'Otomotif', date: '2026-08-15', image: img.car },
  { id: 'prf_12', providerId: 'prv_tukang', serviceId: 'svc_rumah', title: 'Kran dapur bocor', description: 'Perbaikan tanpa bongkar meja.', category: 'Jasa Rumah', date: '2026-04-19', image: img.plumb },
];

const users = [
  { id: 'usr_rieke', name: 'Rieke Setiawati', email: 'rieke@andallo.com', phone: '081234567890', passwordHash, role: 'customer', createdAt: '2026-03-01T02:00:00.000Z' },
  { id: 'usr_dina', name: 'Dina Hartono', email: 'dina@andallo.com', phone: '081298765432', passwordHash, role: 'customer', createdAt: '2026-03-04T02:00:00.000Z' },
  { id: 'usr_budi', name: 'Budi Santoso', email: 'budi@andallo.com', phone: '081377788899', passwordHash, role: 'customer', createdAt: '2026-03-06T02:00:00.000Z' },
  { id: 'usr_sari', name: 'Sari Wulandari', email: 'sari@andallo.com', phone: '081812312312', passwordHash, role: 'customer', createdAt: '2026-03-08T02:00:00.000Z' },
  { id: 'usr_admin', name: 'Admin Andallo', email: 'admin@andallo.com', phone: '081200000001', passwordHash, role: 'admin', createdAt: '2026-01-02T02:00:00.000Z' },
];

function booking(row) {
  const svc = services.find((item) => item.id === row.serviceId);
  const pkg = svc.packages.find((item) => item.id === row.packageId);
  const prv = providers.find((item) => item.id === svc.providerId);
  const customer = users.find((item) => item.id === row.customerId);
  return {
    id: row.id,
    customerId: customer.id,
    customerName: customer.name,
    serviceId: svc.id,
    serviceName: svc.name,
    providerId: prv.id,
    providerName: prv.businessName,
    packageId: pkg.id,
    packageName: pkg.name,
    date: row.date,
    time: row.time,
    location: row.location,
    notes: row.notes || '',
    ...quote(pkg.price),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || row.createdAt,
  };
}

const bookings = [
  booking({ id: 'ADL-1001', customerId: 'usr_rieke', serviceId: 'svc_foto', packageId: 'pkg_foto_akad', date: '2026-10-04', time: '09:00', location: 'Gedung Graha Kencana, Karawaci, Tangerang', notes: 'Akad pukul 09.00, mohon datang 30 menit lebih awal.', status: 'pending', createdAt: '2026-09-20T03:00:00.000Z' }),
  booking({ id: 'ADL-1002', customerId: 'usr_rieke', serviceId: 'svc_bersih', packageId: 'pkg_bersih_2', date: '2026-10-02', time: '08:00', location: 'Perumahan Harapan Indah blok C12, Bekasi Utara', notes: 'Ada anjing kecil, mohon dikandangkan.', status: 'confirmed', createdAt: '2026-09-18T03:00:00.000Z', updatedAt: '2026-09-18T06:00:00.000Z' }),
  booking({ id: 'ADL-1003', customerId: 'usr_rieke', serviceId: 'svc_katering', packageId: 'pkg_katering_50', date: '2026-08-20', time: '10:00', location: 'Rumah keluarga, Dago Pojok, Bandung', notes: 'Dua tamu tidak makan sapi.', status: 'completed', createdAt: '2026-08-01T03:00:00.000Z', updatedAt: '2026-08-20T12:00:00.000Z' }),
  booking({ id: 'ADL-1004', customerId: 'usr_rieke', serviceId: 'svc_ac', packageId: 'pkg_ac_cuci', date: '2026-09-01', time: '13:00', location: 'Apartemen Margonda Residence tower B, Depok', status: 'cancelled', createdAt: '2026-08-25T03:00:00.000Z', updatedAt: '2026-08-26T03:00:00.000Z' }),
  booking({ id: 'ADL-1005', customerId: 'usr_dina', serviceId: 'svc_foto', packageId: 'pkg_foto_penuh', date: '2026-06-14', time: '08:00', location: 'Rumah keluarga pengantin, Alam Sutera, Tangerang', status: 'completed', createdAt: '2026-05-20T03:00:00.000Z', updatedAt: '2026-06-15T03:00:00.000Z' }),
  booking({ id: 'ADL-1006', customerId: 'usr_sari', serviceId: 'svc_foto', packageId: 'pkg_foto_akad', date: '2026-07-02', time: '09:00', location: 'Masjid Al-Azhar, Jakarta Selatan', status: 'completed', createdAt: '2026-06-10T03:00:00.000Z', updatedAt: '2026-07-03T03:00:00.000Z' }),
  booking({ id: 'ADL-1007', customerId: 'usr_budi', serviceId: 'svc_makeup', packageId: 'pkg_makeup_seharian', date: '2026-05-20', time: '06:00', location: 'Kemang, Jakarta Selatan', notes: 'Untuk adik yang menikah.', status: 'completed', createdAt: '2026-05-01T03:00:00.000Z', updatedAt: '2026-05-20T15:00:00.000Z' }),
  booking({ id: 'ADL-1008', customerId: 'usr_sari', serviceId: 'svc_makeup', packageId: 'pkg_makeup_pagi', date: '2026-04-11', time: '07:00', location: 'Tebet, Jakarta Selatan', status: 'completed', createdAt: '2026-03-28T03:00:00.000Z', updatedAt: '2026-04-11T12:00:00.000Z' }),
  booking({ id: 'ADL-1009', customerId: 'usr_dina', serviceId: 'svc_katering', packageId: 'pkg_katering_100', date: '2026-03-18', time: '11:00', location: 'Villa Dago, Bandung', status: 'completed', createdAt: '2026-03-01T03:00:00.000Z', updatedAt: '2026-03-18T16:00:00.000Z' }),
  booking({ id: 'ADL-1010', customerId: 'usr_budi', serviceId: 'svc_bersih', packageId: 'pkg_bersih_4', date: '2026-07-21', time: '09:00', location: 'Harapan Indah, Bekasi', status: 'completed', createdAt: '2026-07-10T03:00:00.000Z', updatedAt: '2026-07-21T14:00:00.000Z' }),
  booking({ id: 'ADL-1011', customerId: 'usr_sari', serviceId: 'svc_bersih', packageId: 'pkg_bersih_2', date: '2026-06-02', time: '08:00', location: 'Jatiwarna, Bekasi', status: 'completed', createdAt: '2026-05-25T03:00:00.000Z', updatedAt: '2026-06-02T12:00:00.000Z' }),
  booking({ id: 'ADL-1012', customerId: 'usr_budi', serviceId: 'svc_ac', packageId: 'pkg_ac_overhaul', date: '2026-06-30', time: '10:00', location: 'Margonda, Depok', status: 'completed', createdAt: '2026-06-18T03:00:00.000Z', updatedAt: '2026-06-30T13:00:00.000Z' }),
  booking({ id: 'ADL-1013', customerId: 'usr_dina', serviceId: 'svc_ac', packageId: 'pkg_ac_cuci', date: '2026-05-08', time: '15:00', location: 'Beji, Depok', status: 'completed', createdAt: '2026-05-02T03:00:00.000Z', updatedAt: '2026-05-08T16:00:00.000Z' }),
  booking({ id: 'ADL-1014', customerId: 'usr_sari', serviceId: 'svc_event', packageId: 'pkg_event_inti', date: '2026-05-02', time: '16:00', location: 'Rumah orang tua, Menteng', status: 'completed', createdAt: '2026-04-12T03:00:00.000Z', updatedAt: '2026-05-02T20:00:00.000Z' }),
  booking({ id: 'ADL-1015', customerId: 'usr_dina', serviceId: 'svc_event', packageId: 'pkg_event_penuh', date: '2026-02-14', time: '10:00', location: 'Kafe di Senopati, Jakarta', status: 'completed', createdAt: '2026-01-20T03:00:00.000Z', updatedAt: '2026-02-14T18:00:00.000Z' }),
  booking({ id: 'ADL-1016', customerId: 'usr_sari', serviceId: 'svc_salon', packageId: 'pkg_salon_lengkap', date: '2026-03-28', time: '13:00', location: 'Salon Pelukan, Setiabudi, Bandung', status: 'completed', createdAt: '2026-03-20T03:00:00.000Z', updatedAt: '2026-03-28T16:00:00.000Z' }),
  booking({ id: 'ADL-1017', customerId: 'usr_dina', serviceId: 'svc_salon', packageId: 'pkg_salon_rambut', date: '2026-08-02', time: '11:00', location: 'Salon Pelukan, Setiabudi, Bandung', status: 'completed', createdAt: '2026-07-28T03:00:00.000Z', updatedAt: '2026-08-02T13:00:00.000Z' }),
  booking({ id: 'ADL-1018', customerId: 'usr_budi', serviceId: 'svc_mobil', packageId: 'pkg_mobil_oli', date: '2026-08-15', time: '08:00', location: 'Jatiasih, Bekasi', status: 'completed', createdAt: '2026-08-10T03:00:00.000Z', updatedAt: '2026-08-15T09:00:00.000Z' }),
  booking({ id: 'ADL-1019', customerId: 'usr_sari', serviceId: 'svc_mobil', packageId: 'pkg_mobil_inspeksi', date: '2026-07-07', time: '09:00', location: 'Cibubur, Bekasi', status: 'completed', createdAt: '2026-07-01T03:00:00.000Z', updatedAt: '2026-07-07T10:00:00.000Z' }),
  booking({ id: 'ADL-1020', customerId: 'usr_budi', serviceId: 'svc_rumah', packageId: 'pkg_rumah_jam', date: '2026-04-19', time: '10:00', location: 'BSD sektor 1.3, Tangerang', status: 'completed', createdAt: '2026-04-15T03:00:00.000Z', updatedAt: '2026-04-19T12:00:00.000Z' }),
  booking({ id: 'ADL-1021', customerId: 'usr_dina', serviceId: 'svc_rumah', packageId: 'pkg_rumah_3', date: '2026-06-22', time: '09:00', location: 'Gading Serpong, Tangerang', status: 'completed', createdAt: '2026-06-16T03:00:00.000Z', updatedAt: '2026-06-22T13:00:00.000Z' }),
  booking({ id: 'ADL-1022', customerId: 'usr_sari', serviceId: 'svc_bersih', packageId: 'pkg_bersih_2', date: '2026-09-12', time: '08:00', location: 'Rawalumbu, Bekasi', status: 'completed', createdAt: '2026-09-05T03:00:00.000Z', updatedAt: '2026-09-12T12:00:00.000Z' }),
];

// Makeup booking uses 06:00 which is NOT in TIME_SLOTS. That's ok for historical seed; new bookings validate slots.
// Event booking 16:00 is in slots. 06:00 might be ok as stored data. Leave it.

const reviewText = [
  ['ADL-1005', 5, 'Foto akadnya hangat dan tidak kaku. Keluarga dapat galeri dalam empat hari, sesuai janji.'],
  ['ADL-1006', 4, 'Hasil foto rapi. Sedikit terlambat 15 menit karena macet, tapi dikabari sebelumnya.'],
  ['ADL-1007', 5, 'Makeup adik saya bertahan sampai malam dan tidak terasa berat. Uji cobanya membantu sekali.'],
  ['ADL-1008', 5, 'Hairdo hijabnya rapi dan mudah dilepas sendiri setelah acara.'],
  ['ADL-1009', 4, 'Makanan hangat sampai tamu terakhir. Porsi nasi agak kurang di akhir, tapi cepat ditambah.'],
  ['ADL-1010', 5, 'Dapur dan kamar mandi kelihatan beda. Timnya sopan dan tidak berisik.'],
  ['ADL-1011', 4, 'Rumah dua kamar selesai sekitar tiga jam. Ada satu sudut jendela yang saya minta diulang, langsung dibereskan.'],
  ['ADL-1022', 5, 'Datang tepat waktu. Saya dikirimi catatan bagian yang sudah dibersihkan.'],
  ['ADL-1012', 5, 'AC yang sebelumnya netes sekarang dingin normal. Teknisi menjelaskan penyebabnya dengan bahasa biasa.'],
  ['ADL-1013', 4, 'Cuci AC selesai cepat. Sedikit berantakan di lantai, lalu dibersihkan sebelum pergi.'],
  ['ADL-1014', 5, 'Rundown lamaran berjalan tenang. Koordinatornya tegas tapi tidak memotong keluarga.'],
  ['ADL-1015', 4, 'Vendor dekor datang sesuai jadwal. Komunikasi sehari sebelumnya sangat jelas.'],
  ['ADL-1016', 5, 'Rambut terasa lebih ringan. Facialnya tidak perih di kulit saya yang sensitif.'],
  ['ADL-1017', 4, 'Potongannya sesuai foto yang saya tunjukkan. Antreannya tidak ada karena janji jam.'],
  ['ADL-1018', 5, 'Oli diganti di carport, tidak perlu mendorong mobil. Nota jasanya sesuai harga di Andallo.'],
  ['ADL-1019', 4, 'Laporan 20 titiknya singkat dan bisa saya baca ulang. Aki memang sudah lemah, sesuai temuan.'],
  ['ADL-1020', 5, 'Kran tidak bocor lagi sejak hari itu. Pengerjaannya tidak merusak kabinet.'],
  ['ADL-1021', 4, 'Tiga titik selesai dalam satu kunjungan. Engsel pintu kamar sedikit longgar lagi setelah seminggu, lalu dibantu lewat catatan.'],
];

const reviews = reviewText.map(([bookingId, rating, text], index) => {
  const row = bookings.find((item) => item.id === bookingId);
  return {
    id: `rev_${index + 1}`,
    bookingId: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    providerId: row.providerId,
    customerId: row.customerId,
    customerName: row.customerName,
    rating,
    text,
    createdAt: row.updatedAt,
  };
});

const db = {
  users,
  categories,
  providers,
  services,
  portfolios,
  reviews,
  bookings,
  savedServices: [
    { id: 'sav_1', customerId: 'usr_rieke', serviceId: 'svc_foto', createdAt: '2026-09-15T03:00:00.000Z' },
    { id: 'sav_2', customerId: 'usr_rieke', serviceId: 'svc_makeup', createdAt: '2026-09-16T03:00:00.000Z' },
  ],
  revokedTokens: [],
  resetTokens: [],
  settings: { platformFeePercent: 5, supportEmail: 'halo@andallo.id' },
};

fs.writeFileSync(path.join(root, 'data', 'db.json'), JSON.stringify(db, null, 2) + '\n');
console.log(`seeded ${services.length} services, ${reviews.length} reviews, ${bookings.length} bookings`);
