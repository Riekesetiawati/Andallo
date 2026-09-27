import Link from 'next/link';
import { STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { listComplaints } from '@/lib/repo';

export default async function MitraComplaints() {
  const actor = await requireActor('provider');
  const rows = await listComplaints(actor);
  return (
    <div>
      <h1 className="text-3xl">Komplain</h1>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => <Link key={row.id} href={`/mitra/complaints/${row.id}`} className="card block p-4"><p className="font-bold">{row.title}</p><p className="text-sm">{row.code} · {STATUS_LABEL[row.status]}</p></Link>)}
        {!rows.length ? <p className="text-muted">Belum ada komplain.</p> : null}
      </div>
    </div>
  );
}
