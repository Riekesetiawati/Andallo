# Andallo

Marketplace jasa: pelanggan mencari, membandingkan, dan memesan penyedia di sekitar mereka. Admin mengelola penyedia, jasa, kategori, pesanan, dan ulasan.

Tagline: **Andallo, jasa andalanmu setiap saat.**

Hanya ada dua peran: pelanggan dan admin. Penyedia tidak punya akun login.

## Menjalankan

Butuh Node.js 22. Tidak ada dependency npm.

```bash
npm test
npm start
```

Buka http://localhost:3000

Salin `.env.example` menjadi `.env` bila ingin mengatur `SESSION_SECRET`. Tanpa variabel itu, aplikasi memakai kunci demo dan menuliskan peringatan.

### Akun demo

Kata sandi semua akun: `Demo1234`

| Peran | Email |
| --- | --- |
| Pelanggan | rieke@andallo.com |
| Admin | admin@andallo.com |

Pelanggan lain untuk data ulasan: `dina@andallo.com`, `budi@andallo.com`, `sari@andallo.com`.

## Data

`data/db.json` adalah penyimpanan demo (pengguna, penyedia, jasa, portofolio, ulasan, pesanan, simpanan). Akses data ada di `lib/data.js` supaya nanti bisa diganti PostgreSQL atau Supabase tanpa mengubah halaman.

Ulangi data awal:

```bash
node scripts/seed.js
```

Kata sandi disimpan sebagai hash scrypt. Ulasan hanya bisa ditulis pelanggan yang pesanannya berstatus selesai.

Di Vercel, file database disalin ke `/tmp` dan kembali ke data awal saat instance baru. Set `SESSION_SECRET` di environment project.

## Vercel

`public/` adalah situs. `api/[...path].js` menjalankan API yang sama dengan `server.js`.

```bash
npm test
node --check server.js && node --check lib/data.js && node --check lib/auth.js && node --check lib/store.js && node --check "api/[...path].js"
git push origin main
```

Import repo `Riekesetiawati/Andallo`, branch `main`, framework Other.
