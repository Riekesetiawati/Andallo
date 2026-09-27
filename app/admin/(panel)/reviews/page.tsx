import { reviewHideAction } from '@/app/actions';
import { adminList } from '@/lib/repo';

export default async function ReviewsPage() {
  const rows = await adminList('reviews');
  return (
    <div>
      <h1 className="text-3xl">Ulasan</h1>
      <p className="text-sm text-muted">Moderasi hanya menyembunyikan ulasan. Angka rating pelanggan tidak diubah.</p>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="card p-4">
            <p className="font-bold">{row.rating} ★ · {row.business_name}</p>
            <p>{row.comment}</p>
            <p className="text-sm text-muted">{row.full_name} · {row.code} {row.hidden_at ? '· disembunyikan' : ''}</p>
            <form action={reviewHideAction} className="mt-2">
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="hide" value={row.hidden_at ? '0' : '1'} />
              <button className="btn">{row.hidden_at ? 'Tampilkan lagi' : 'Sembunyikan'}</button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
