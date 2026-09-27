import { deleteHighlightAction, highlightOrderAction } from '@/app/actions';
import { HighlightForm } from '@/components/mitra-forms';
import { adminList } from '@/lib/repo';

export default async function HighlightsPage() {
  const [rows, providers] = await Promise.all([adminList('highlights'), adminList('providers')]);
  const ids = rows.map((row) => row.id as string);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-3xl">Highlight mitra</h1>
        <div className="mt-4 grid gap-3">
          {rows.map((row, index) => {
            const next = [...ids];
            const swap = index - 1;
            if (swap >= 0) [next[index], next[swap]] = [next[swap], next[index]];
            const down = [...ids];
            const lower = index + 1;
            if (lower < down.length) [down[index], down[lower]] = [down[lower], down[index]];
            return (
              <article key={row.id} className="card p-4">
                <p className="font-bold">{row.headline}</p>
                <p className="text-sm text-muted">{row.business_name} · {row.is_active ? 'aktif' : 'nonaktif'}</p>
                <div className="mt-2 flex gap-2">
                  <form action={highlightOrderAction}><input type="hidden" name="ids" value={next.join(',')} /><button className="btn" disabled={index === 0}>Naik</button></form>
                  <form action={highlightOrderAction}><input type="hidden" name="ids" value={down.join(',')} /><button className="btn" disabled={index === ids.length - 1}>Turun</button></form>
                  <form action={deleteHighlightAction}><input type="hidden" name="id" value={row.id} /><button className="btn">Hapus</button></form>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <HighlightForm providers={providers.filter((row) => row.status === 'VERIFIED').map((row) => ({ id: row.id, business_name: row.business_name }))} />
    </div>
  );
}
