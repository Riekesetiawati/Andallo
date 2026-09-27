import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container py-20 text-center">
      <h1 className="text-4xl">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-muted">Tautan ini tidak mengarah ke halaman Andallo.</p>
      <Link className="btn btn-primary mt-4" href="/">Kembali ke beranda</Link>
    </div>
  );
}
