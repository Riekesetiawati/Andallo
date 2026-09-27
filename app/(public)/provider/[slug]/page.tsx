import Link from 'next/link';
import { notFound } from 'next/navigation';
import { compareAction, favoriteAction } from '@/app/actions';
import { Stars } from '@/components/chrome';
import { LeafletMap } from '@/components/map';
import { getProvider } from '@/lib/catalog';
import { METHOD_LABEL, rupiah } from '@/lib/format';
import { getActor } from '@/lib/session';

export default async function ProviderPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ lat?: string; lng?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const actor = await getActor();
  const coords = query.lat && query.lng ? { lat: Number(query.lat), lng: Number(query.lng) } : undefined;
  const data = await getProvider(slug, actor, coords);
  if (!data) notFound();
  const provider = data.provider;
  const dist = [5, 4, 3, 2, 1].map((star) => ({ star, count: Number(data.distribution.find((row) => Number(row.rating) === star)?.count || 0) }));
  const max = Math.max(1, ...dist.map((item) => item.count));
  return (
    <div className="container py-8">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="grid gap-5">
          {provider.cover_url ? <img src={provider.cover_url} alt="" className="h-64 w-full rounded-3xl object-cover" /> : null}
          <div>
            <p className="text-sm font-bold text-leaf">{provider.category_name} · {provider.city}</p>
            <h1 className="text-4xl">{provider.business_name}</h1>
            <p className="mt-1">{provider.status === 'VERIFIED' ? <span className="badge">Terverifikasi</span> : provider.status}</p>
            <Stars rating={Number(provider.rating)} count={Number(provider.review_count)} />
            <p className="mt-2 text-muted">{provider.distance_km == null ? `Radius layanan ${provider.service_radius_km} km` : `${provider.distance_km} km dari kamu · radius ${provider.service_radius_km} km`}</p>
            <p className="mt-3 max-w-2xl">{provider.description}</p>
            <p className="mt-2 text-sm">{METHOD_LABEL[provider.service_method] || provider.service_method}</p>
          </div>
          <section>
            <h2 className="text-2xl">Jasa dan paket</h2>
            <div className="mt-3 grid gap-3">
              {data.services.map((service) => (
                <article key={service.id} className="card p-4">
                  <h3 className="text-xl">{service.name}</h3>
                  <p className="text-sm text-muted">{service.description}</p>
                  <div className="mt-3 grid gap-2">
                    {(service.packages || []).map((pkg: { id: string; name: string; description: string; price: number; durationMin: number }) => (
                      <div key={pkg.id} className="flex items-center justify-between gap-3 rounded-2xl bg-sand px-3 py-2">
                        <div><strong>{pkg.name}</strong><p className="text-sm text-muted">{pkg.description} · {pkg.durationMin} menit</p></div>
                        <div className="text-right"><p className="font-bold">{rupiah(pkg.price)}</p><Link className="text-sm font-bold text-leaf" href={`/pesan/${service.id}?paket=${pkg.id}`}>Pesan</Link></div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-2xl">Portofolio</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              {data.portfolio.map((item) => (
                <figure key={item.id} className="card overflow-hidden"><img src={item.image_url} alt={item.caption} className="h-36 w-full object-cover" /><figcaption className="p-3 text-sm">{item.caption}</figcaption></figure>
              ))}
              {!data.portfolio.length ? <p className="text-muted">Belum ada portofolio.</p> : null}
            </div>
          </section>
          <section>
            <h2 className="text-2xl">Ulasan</h2>
            <div className="mt-3 grid gap-2">
              {dist.map((item) => (
                <div key={item.star} className="grid grid-cols-[40px_1fr_24px] items-center gap-2 text-sm"><span>{item.star} ★</span><span className="h-2 rounded-full bg-mint"><span className="block h-2 rounded-full bg-leaf" style={{ width: `${(item.count / max) * 100}%` }} /></span><span>{item.count}</span></div>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {data.reviews.map((review) => (
                <article key={review.id} className="card p-4"><Stars rating={Number(review.rating)} /><p className="mt-2">{review.comment}</p><p className="mt-2 text-sm text-muted">{review.full_name} · {review.service_name}</p></article>
              ))}
              {!data.reviews.length ? <p className="text-muted">Belum ada ulasan.</p> : null}
            </div>
          </section>
          {provider.lat ? <LeafletMap center={{ lat: Number(provider.lat), lng: Number(provider.lng) }} markers={[{ lat: Number(provider.lat), lng: Number(provider.lng), label: provider.business_name }]} /> : null}
        </div>
        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <p className="text-sm text-muted">Mulai dari</p>
          <p className="text-3xl font-bold">{rupiah(data.services[0]?.min_price)}</p>
          <div className="mt-4 grid gap-2">
            {data.services[0] ? <Link className="btn btn-primary" href={`/pesan/${data.services[0].id}`}>Pesan Jasa</Link> : null}
            {data.services[0] ? <form action={compareAction}><input type="hidden" name="serviceId" value={data.services[0].id} /><button className="btn w-full" type="submit">Bandingkan</button></form> : null}
            {actor?.role === 'customer' ? <form action={favoriteAction}><input type="hidden" name="providerId" value={provider.id} /><button className="btn w-full" type="submit">{data.favorite ? 'Hapus favorit' : 'Favorit'}</button></form> : <Link className="btn w-full" href={`/login?next=/provider/${slug}`}>Favorit</Link>}
          </div>
        </aside>
      </div>
    </div>
  );
}
