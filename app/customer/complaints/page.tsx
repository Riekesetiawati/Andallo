import Link from 'next/link';
import { Empty } from '@/components/chrome';
import { STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { listComplaints } from '@/lib/repo';

export default async function CustomerComplaints() {
  const actor = await requireActor('customer');
  const rows = await listComplaints(actor);
  if (!rows.length) return <Empty title="Belum ada komplain" text="Komplain selalu terikat ke pesanan dan tidak dihapus diam-diam." />;
  return (
    <div>
      <h1 className="text-3xl">Komplain</h1>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <Link key={row.id} href={`/customer/complaints/${row.id}`} className="card block p-4">
            <p className="font-bold">{row.title}</p>
            <p className="text-sm text-muted">{row.code} · {STATUS_LABEL[row.status] || row.status}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
