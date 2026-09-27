import { providerStatusAction } from '@/app/actions';
import { STATUS_LABEL } from '@/lib/format';
import { adminList } from '@/lib/repo';

const actions = ['UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'];

export default async function ProvidersPage() {
  const rows = await adminList('providers');
  return (
    <div>
      <h1 className="text-3xl">Mitra</h1>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">{row.business_name}</p>
                <p className="text-sm text-muted">{row.full_name} · {row.email} · {row.city} · {row.category_name}</p>
                <span className="badge mt-2">{STATUS_LABEL[row.status] || row.status}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {actions.map((status) => (
                  <form key={status} action={providerStatusAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="status" value={status} />
                    <input type="hidden" name="note" value={`Diubah menjadi ${status}`} />
                    <button className="btn">{STATUS_LABEL[status]}</button>
                  </form>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
