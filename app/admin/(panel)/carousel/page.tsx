import { deleteCarouselAction } from '@/app/actions';
import { CarouselForm } from '@/components/mitra-forms';
import { adminList } from '@/lib/repo';

export default async function CarouselPage() {
  const rows = await adminList('carousel');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-3xl">Carousel beranda</h1>
        <div className="mt-4 grid gap-3">
          {rows.map((row) => (
            <article key={row.id} className="card p-4">
              <p className="font-bold">{row.title}</p>
              <p className="text-sm text-muted">{row.subtitle} · {row.is_active ? 'aktif' : 'nonaktif'}</p>
              <form action={deleteCarouselAction} className="mt-2"><input type="hidden" name="id" value={row.id} /><button className="btn">Hapus</button></form>
            </article>
          ))}
        </div>
      </div>
      <CarouselForm />
    </div>
  );
}
