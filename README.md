# Andallo — Situs Jasa (Biru)

Situs interaktif privat dengan pencarian jasa, pilihan lokasi, detail penyedia, perbandingan harga, permintaan booking, chat, dan alur bukti pembayaran contoh.

## Menjalankan pengecekan

- `npm run build` membuat Worker Cloudflare dalam `dist/server/index.js`.
- `npm test` memeriksa alur pesanan, berkas bukti, akses, dan referensi antarmuka.

Kode utama ada di `index.html` (HTML dan interaksi), `theme.css` (gaya), `payments.js` (alur pesanan) dan `worker.js` (API dan penyimpanan R2). `build.mjs` memasukkan aset lokal ke Worker.

Akun dan katalog memakai data contoh, dan identitas masuk dalam aplikasi belum menjadi sistem autentikasi produksi. Data pesanan dan berkas bukti tersimpan terpisah untuk setiap pemilik Site yang masuk melalui ChatGPT. Pembayaran hanya simulasi karena tidak ada rekening tujuan atau penyedia layanan pembayaran yang dikonfigurasi. Form bantuan menyediakan pratinjau dan tidak mengirim pesan. Jangan gunakan untuk transaksi nyata.
