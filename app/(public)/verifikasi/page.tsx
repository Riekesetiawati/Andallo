import Link from 'next/link';
import { verifyEmail } from '@/lib/repo';

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const ok = params.token ? await verifyEmail(params.token) : false;
  return (
    <div className="container py-12">
      <div className="card mx-auto max-w-md p-6">
        <h1 className="text-3xl">{ok ? 'Email terverifikasi' : 'Tautan tidak berlaku'}</h1>
        <p className="mt-2 text-muted">{ok ? 'Akun siap dipakai. Anda sudah bisa masuk dan memesan.' : 'Token salah atau sudah kedaluwarsa. Daftar ulang atau minta tautan baru.'}</p>
        <Link className="btn btn-primary mt-4" href="/login">Masuk</Link>
      </div>
    </div>
  );
}
