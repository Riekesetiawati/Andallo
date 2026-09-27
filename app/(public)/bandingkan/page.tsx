import Link from 'next/link';
import { clearCompareAction, compareAction } from '@/app/actions';
import { Empty, Notice, Stars } from '@/components/chrome';
import { compareServices } from '@/lib/catalog';
import { METHOD_LABEL, rupiah } from '@/lib/format';
import { getActor } from '@/lib/session';

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ notice?: string; lat?: string; lng?: string }> }) {
  const params = await searchParams;
  const actor = await getActor();
  if (!actor || actor.role !== 'customer') {
    return <div className="container py-12"><Empty title="Masuk untuk membandingkan" text="Bandingkan menyimpan hingga 3 jasa dari kategori yang sama." action={<Link className="btn btn-primary" href="/login?next=/bandingkan">Masuk</Link>} /></div>;
  }
  const coords = params.lat && params.lng ? { lat: Number(params.lat), lng: Number(params.lng) } : undefined;
  const items = await compareServices(actor, coords);
  const lowest = items.length ? Math.min(...items.map((item) => item.minPrice)) : null;
  const nearest = items.some((item) => item.distanceKm != null) ? Math.min(...items.filter((item) => item.distanceKm != null).map((item) => item.distanceKm as number)) : null;
  const bestRating = items.length ? Math.max(...items.map((item) => item.rating)) : null;
  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Bandingkan</h1>
          <p className="text-muted">Perbedaan yang ditandai bersifat faktual. Tidak ada peringkat “terbaik” secara keseluruhan.</p>
        </div>
        {items.length ? <form action={clearCompareAction}><button className="btn">Hapus Semua</button></form> : null}
      </div>
      <Notice text={params.notice} />
      {!items.length ? <Empty title="Belum ada yang dibandingkan" text="Tekan Bandingkan pada kartu jasa. Maksimal 3, dan harus satu kategori." action={<Link className="btn btn-primary" href="/jasa">Cari jasa</Link>} /> : (
        <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible">
          {items.map((item) => (
            <article key={item.id} className="card min-w-[280px] snap-start p-4">
              {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-36 w-full rounded-2xl object-cover" /> : null}
              <p className="mt-3 text-sm text-muted">{item.categoryName} · {item.city}</p>
              <h2 className="text-2xl">{item.businessName}</h2>
              <p className="font-semibold">{item.name}</p>
              <span className="badge mt-2">Terverifikasi</span>
              <Stars rating={item.rating} count={item.reviewCount} />
              <ul className="mt-3 grid gap-1 text-sm">
                <li>Harga {rupiah(item.minPrice)} – {rupiah(item.maxPrice)} {item.minPrice === lowest ? <strong className="text-leaf">· Harga paling rendah</strong> : null}</li>
                <li>Jarak {item.distanceKm == null ? 'aktifkan lokasi' : `${item.distanceKm} km`} {item.distanceKm != null && item.distanceKm === nearest ? <strong className="text-leaf">· Jarak paling dekat</strong> : null}</li>
                <li>Rating {item.rating.toFixed(1)} {item.rating === bestRating ? <strong className="text-leaf">· Rating tertinggi</strong> : null}</li>
                <li>{METHOD_LABEL[item.serviceMethod]} · {item.durationMin} menit</li>
                <li>{item.portfolioCount} foto portofolio</li>
                {item.packages.map((pkg: { name: string; price: number }) => <li key={pkg.name}>{pkg.name} {rupiah(pkg.price)}</li>)}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="btn" href={`/provider/${item.slug}`}>Lihat Detail</Link>
                <Link className="btn btn-primary" href={`/pesan/${item.id}`}>Pesan Jasa</Link>
                <form action={compareAction}><input type="hidden" name="serviceId" value={item.id} /><button className="btn">Hapus</button></form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
