import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookForm } from '@/components/forms';
import { getService, slotsFor } from '@/lib/catalog';
import { rupiah, todayJakarta } from '@/lib/format';
import { getActor } from '@/lib/session';

export default async function BookPage({ params, searchParams }: { params: Promise<{ serviceId: string }>; searchParams: Promise<{ paket?: string }> }) {
  const { serviceId } = await params;
  const query = await searchParams;
  const actor = await getActor();
  const data = await getService(serviceId, actor);
  if (!data) notFound();
  const packages = data.packages.map((pkg) => ({ id: pkg.id as string, name: pkg.name as string, price: Number(pkg.price) }));
  const ordered = query.paket ? [...packages].sort((a, b) => (a.id === query.paket ? -1 : b.id === query.paket ? 1 : 0)) : packages;
  const today = todayJakarta();
  const tomorrowDate = new Date(`${today}T12:00:00+07:00`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const initialDate = tomorrowDate.toISOString().slice(0, 10);
  const initialSlots = await slotsFor(data.service.provider_id, initialDate);
  return (
    <div className="container max-w-2xl py-10">
      <p className="text-sm font-bold text-leaf">{data.service.category_name} · {data.service.city}</p>
      <h1 className="text-4xl">Pesan {data.service.name}</h1>
      <p className="mt-1">{data.service.business_name} · mulai {rupiah(data.service.min_price)}</p>
      {!actor || actor.role !== 'customer' ? (
        <div className="card mt-6 p-5">
          <p>Masuk sebagai pelanggan untuk mengirim pesanan.</p>
          <Link className="btn btn-primary mt-3" href={`/login?next=/pesan/${serviceId}`}>Masuk</Link>
        </div>
      ) : !actor.emailVerifiedAt ? (
        <div className="card mt-6 p-5"><p>Verifikasi email terlebih dahulu sebelum memesan.</p></div>
      ) : (
        <div className="mt-6"><BookForm serviceId={serviceId} providerId={data.service.provider_id} packages={ordered} method={data.service.service_method} initialDate={initialDate} initialSlots={initialSlots} /></div>
      )}
    </div>
  );
}
