import { SupportForm } from '@/components/forms';

const faqs = [
  ['Bagaimana cara memesan?', 'Cari jasa, buka detail mitra, pilih paket, tanggal, dan jam yang masih kosong. Mitra punya 2 menit untuk menerima.'],
  ['Mengapa jarak tidak muncul?', 'Jarak dihitung dari koordinat Anda. Tekan Gunakan Lokasi Saya, lalu izinkan browser.'],
  ['Kapan saya bisa memberi ulasan?', 'Hanya setelah status pesanan menjadi Selesai. Satu pesanan, satu ulasan.'],
  ['Bagaimana jika mitra tidak menjawab?', 'Pesanan kedaluwarsa otomatis dan slot dilepas. Anda mendapat notifikasi.'],
];

export default function HelpPage() {
  return (
    <div className="container grid gap-8 py-10 md:grid-cols-2">
      <div>
        <h1 className="text-4xl">Bantuan</h1>
        <div className="mt-4 grid gap-3">
          {faqs.map(([title, text]) => (
            <article key={title} className="card p-4"><h2 className="text-xl">{title}</h2><p className="mt-1 text-sm text-muted">{text}</p></article>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <h2 className="text-2xl">Hubungi Andallo</h2>
        <div className="mt-4"><SupportForm /></div>
      </div>
    </div>
  );
}
