# Andallo Blue Services — Full Project

Project lengkap Andallo yang dapat dijalankan lokal atau di-deploy ke hosting Node.js.

Referensi tampilan:
https://andallo-blue-services.nananishuw.chatgpt.site/

## Isi project

- `public/index.html` — satu web app responsive untuk Customer, Mitra, dan Admin
- `public/assets/andallo-logo.png` — logo Andallo
- `data/db.json` — data dummy penyedia, user, booking, notifikasi, chat template
- `server.js` — backend API Node.js
- `package.json` — konfigurasi project
- `.env.example` — contoh konfigurasi WhatsApp Cloud API
- `Dockerfile` — deployment container

## Akun dummy

Customer
- Email: rieke@andallo.com
- Password: demo123

Mitra
- Email: mitra@andallo.com
- Password: demo123

Admin
- Email: admin@andallo.com
- Password: demo123

## Menjalankan

```bash
npm start
```

Lalu buka:

```text
http://localhost:3000
```

## Fitur utama

- Responsive desktop, tablet, dan mobile
- Login berbasis role
- Navbar untuk Customer/Mitra
- Sidebar khusus Admin
- Pencarian jasa
- Filter dan sorting penyedia
- Jarak penyedia dari lokasi pengguna
- Leaflet + OpenStreetMap
- Booking dan pengecekan tanggal terisi
- Approval pesanan maksimal 2 menit
- Tombol Terima/Tolak untuk Mitra dan Admin
- Lifecycle transaksi
- Live location customer/penyedia
- Chat + template pertanyaan/jawaban singkat
- Notifikasi realtime menggunakan SSE
- Rating setelah layanan selesai
- Integrasi WhatsApp Cloud API melalui environment variable

## Catatan

Project ini adalah paket source portabel yang dibangun dari versi Andallo yang tersedia dalam workspace dan diselaraskan dengan tampilan/fungsi situs live. ChatGPT Sites tidak menyediakan source bundle internal untuk diekspor langsung melalui file API, jadi paket ini adalah source project lengkap yang bisa diedit dan dideploy secara mandiri.
