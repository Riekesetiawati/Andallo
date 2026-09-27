'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container py-20 text-center">
      <h1 className="text-4xl">Terjadi kesalahan saat mengambil data</h1>
      <p className="mt-2 text-muted">Coba lagi. Jika berulang, periksa koneksi dan status database.</p>
      <button className="btn btn-primary mt-4" type="button" onClick={() => reset()}>Coba lagi</button>
    </div>
  );
}
