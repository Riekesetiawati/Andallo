import { ResetForm } from '@/components/forms';

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  if (!params.token) {
    return <div className="container py-12"><div className="card mx-auto max-w-md p-6"><h1 className="text-3xl">Tautan tidak lengkap</h1><p className="mt-2">Buka tautan dari email reset, atau minta tautan baru.</p></div></div>;
  }
  return <div className="container py-12"><ResetForm token={params.token} /></div>;
}
