# Andallo Blue Services

Marketplace jasa Andallo: customer mencari penyedia jasa terdekat, memesan jadwal yang masih kosong, lalu memantau pesanan lewat live tracking dan chat. Mitra (penyedia) dan Admin menerima/menolak pesanan dalam batas 2 menit dan memperbarui status layanan.

Referensi tampilan: https://andallo-blue-services.nananishuw.chatgpt.site/

## Kebutuhan

- Node.js 20.12 atau lebih baru (disarankan Node 22)
- Tidak ada dependency npm — server hanya memakai modul bawaan Node.js
- Browser membutuhkan internet untuk Leaflet (unpkg), tile OpenStreetMap, font, dan foto Unsplash

## Menjalankan

```bash
npm start            # http://localhost:3000
PORT=4317 npm start  # port lain
npm run dev          # auto-restart saat file berubah
npm test             # test API (node:test)
```

Konfigurasi opsional: salin `.env.example` menjadi `.env`. File `.env` dibaca otomatis saat start.

### Docker

```bash
docker build -t andallo .
docker run -p 3000:3000 -v "$PWD/data:/app/data" andallo
```

## Akun demo

Semua akun memakai kata sandi `demo123`.

| Peran    | Email               |
| -------- | ------------------- |
| Customer | rieke@andallo.com   |
| Mitra    | mitra@andallo.com   |
| Admin    | admin@andallo.com   |

## Struktur project

```text
server.js                 Backend HTTP + REST API + SSE (tanpa dependency)
public/index.html         Shell web app (satu app untuk Customer, Mitra, Admin)
public/app.js             Logika UI: routing, booking, tracking, chat, dashboard
public/app.css            Styling responsive (desktop, tablet, mobile)
public/assets/            Logo Andallo
data/db.json              Database JSON (penyedia, user, booking, notifikasi, template chat)
test/api.test.js          Test API end-to-end
.env.example              Contoh konfigurasi (port, WhatsApp Cloud API)
Dockerfile                Deployment container
```

## Fitur

- Login berbasis peran; navbar untuk Customer/Mitra, sidebar untuk Admin
- Pencarian jasa, filter kategori, sorting (terdekat, rating, harga)
- Jarak penyedia dari lokasi pengguna (geolokasi browser, default pusat Bekasi)
- Peta Leaflet + OpenStreetMap
- Kalender booking: tanggal yang sudah memiliki pesanan aktif ditandai merah dan tidak bisa dipilih
- Persetujuan pesanan maksimal 2 menit (otomatis kedaluwarsa), tombol Terima/Tolak untuk Mitra dan Admin
- Lifecycle: Menunggu → Diterima → Dalam perjalanan → Sedang dikerjakan → Selesai (atau Ditolak / Kedaluwarsa / Dibatalkan)
- Live location customer & penyedia saat pesanan aktif
- Chat per pesanan dengan template pertanyaan/jawaban cepat dan balasan otomatis AI Andallo
- Notifikasi real-time via Server-Sent Events
- Rating 1–5 setelah pesanan selesai
- Notifikasi WhatsApp Cloud API bila `WHATSAPP_TOKEN` dan `WHATSAPP_PHONE_NUMBER_ID` diisi; tanpa kredensial, notifikasi tetap tampil di dashboard

## API ringkas

Semua endpoint di bawah `/api`. Endpoint terproteksi memakai header `Authorization: Bearer <token>` dari `POST /api/auth/login`.

| Method | Path | Akses |
| ------ | ---- | ----- |
| POST | `/auth/login`, `/auth/logout` | publik |
| GET | `/me`, `/notifications`, `/chat-templates` | login |
| GET | `/categories`, `/providers`, `/providers/:id`, `/providers/:id/booked-dates` | publik |
| GET/POST | `/bookings` | login / customer |
| GET | `/bookings/:id` | pihak terkait |
| POST | `/bookings/:id/decision` | mitra pemilik, admin |
| POST | `/bookings/:id/status` | sesuai peran & status |
| POST | `/bookings/:id/location` | customer, mitra |
| GET/POST | `/bookings/:id/chat` | pihak terkait |
| POST | `/bookings/:id/rating` | customer, setelah selesai |
| GET | `/admin/overview` | admin |
| GET | `/events?token=` | SSE, login |

## Catatan keamanan & data

- Kata sandi disimpan sebagai hash scrypt (`passwordHash`). File `db.json` lama yang masih berisi `password` teks biasa akan dimigrasi otomatis saat server start.
- Sesi disimpan di memori server dan berlaku 12 jam; restart server berarti semua pengguna perlu login ulang.
- `data/db.json` ditulis ulang oleh server setiap ada perubahan (penulisan atomik). Cocok untuk demo/instans tunggal, bukan untuk banyak instans sekaligus.
- Pembayaran belum terhubung payment gateway.
