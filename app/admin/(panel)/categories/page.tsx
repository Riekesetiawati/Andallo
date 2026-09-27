import { categoryMoveAction, categoryToggleAction } from '@/app/actions';
import { CategoryForm } from '@/components/mitra-forms';
import { listCategories } from '@/lib/catalog';

export default async function CategoriesPage() {
  const rows = await listCategories(true);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-3xl">Kategori</h1>
        <div className="mt-4 grid gap-2">
          {rows.map((row) => (
            <div key={row.id} className="card flex items-center justify-between gap-2 p-3">
              <div><p className="font-bold">{row.name}</p><p className="text-xs text-muted">{row.is_active ? 'aktif' : 'nonaktif'} · {row.service_count} jasa</p></div>
              <div className="flex gap-2">
                <form action={categoryMoveAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="direction" value="-1" /><button className="btn">Naik</button></form>
                <form action={categoryMoveAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="direction" value="1" /><button className="btn">Turun</button></form>
                <form action={categoryToggleAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="name" value={row.name} /><input type="hidden" name="icon" value={row.icon || 'sparkles'} /><input type="hidden" name="active" value={row.is_active ? '' : 'on'} /><button className="btn">{row.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></form>
              </div>
            </div>
          ))}
        </div>
      </div>
      <CategoryForm />
    </div>
  );
}
