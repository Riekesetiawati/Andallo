import Link from 'next/link';
import { complaintStatusAction } from '@/app/actions';
import { STATUS_LABEL } from '@/lib/format';
import { listComplaints } from '@/lib/repo';
import { requireActor } from '@/lib/guard';

const statuses = ['OPEN', 'UNDER_REVIEW', 'NEED_MORE_INFO', 'RESOLVED', 'REJECTED'];

export default async function AdminComplaints() {
  const actor = await requireActor('admin');
  const rows = await listComplaints(actor);
  return (
    <div>
      <h1 className="text-3xl">Komplain</h1>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <article key={row.id} className="card p-4">
            <Link href={`/admin/complaints/${row.id}`} className="font-bold text-leaf">{row.title}</Link>
            <p className="text-sm text-muted">{row.code} · {row.opener_name} · {STATUS_LABEL[row.status]}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {statuses.map((status) => (
                <form key={status} action={complaintStatusAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value={status} /><button className="btn">{STATUS_LABEL[status] || status}</button></form>
              ))}
            </div>
          </article>
        ))}
        {!rows.length ? <p className="text-muted">Tidak ada komplain.</p> : null}
      </div>
    </div>
  );
}
