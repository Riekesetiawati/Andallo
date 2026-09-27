import Link from 'next/link';
import { Filters } from '@/components/filters';
import { Notice } from '@/components/chrome';
import { ServiceCardView } from '@/components/service-card';
import { listCategories, searchServices, type SearchFilters } from '@/lib/catalog';
import { todayJakarta } from '@/lib/format';
import { getActor } from '@/lib/session';

export default async function JasaPage({ searchParams }: { searchParams: Promise<SearchFilters & { notice?: string; use?: string }> }) {
  const params = await searchParams;
  const actor = await getActor();
  const [result, categories] = await Promise.all([searchServices(params, actor), listCategories()]);
  const today = todayJakarta();
  const tomorrowDate = new Date(`${today}T12:00:00+07:00`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && key !== 'page') query.set(key, value);
  return (
    <div className="container py-8">
      <h1 className="text-4xl">Cari jasa</h1>
      <p className="mt-2 text-muted">Filter dihitung di server. Jarak hanya muncul bila lokasi Anda dikirim.</p>
      <Notice text={params.notice} />
      <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
        <Filters defaults={params} categories={categories} today={today} tomorrow={tomorrow} />
        <div>
          <p className="mb-3 text-sm text-muted">{result.total} jasa ditemukan</p>
          {result.items.length ? (
            <div className="grid gap-4 md:grid-cols-2">{result.items.map((service) => <ServiceCardView key={service.id} service={service} favorite={actor?.role === 'customer'} />)}</div>
          ) : (
            <div className="card p-8 text-center"><h2 className="text-2xl">Tidak ada penyedia di filter ini</h2><p className="mt-2 text-muted">Longgarkan harga, jarak, atau kategori.</p><a className="btn mt-4" href="/jasa">Reset filter</a></div>
          )}
          <div className="mt-6 flex gap-2">
            {result.page > 1 ? <Link className="btn" href={`/jasa?${query.toString()}&page=${result.page - 1}`}>Sebelumnya</Link> : null}
            {result.page < result.pages ? <Link className="btn" href={`/jasa?${query.toString()}&page=${result.page + 1}`}>Berikutnya</Link> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
