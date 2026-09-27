import Link from 'next/link';
import { favoriteAction } from '@/app/actions';
import { Empty } from '@/components/chrome';
import { requireActor } from '@/lib/guard';
import { listFavorites } from '@/lib/repo';

export default async function FavoritesPage() {
  const actor = await requireActor('customer');
  const rows = await listFavorites(actor);
  if (!rows.length) return <Empty title="Belum ada favorit" text="Simpan mitra yang ingin Anda bandingkan lagi." action={<Link className="btn btn-primary" href="/jasa">Cari jasa</Link>} />;
  return (
    <div>
      <h1 className="text-3xl">Favorit</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className="card p-4">
            <p className="text-sm text-muted">{row.category_name} · {row.city}</p>
            <h2 className="text-2xl">{row.business_name}</h2>
            <div className="mt-3 flex gap-2">
              <Link className="btn" href={`/provider/${row.slug}`}>Detail</Link>
              <form action={favoriteAction}><input type="hidden" name="providerId" value={row.id} /><button className="btn">Hapus</button></form>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
