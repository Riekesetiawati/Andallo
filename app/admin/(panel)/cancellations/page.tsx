import { formatDate } from '@/lib/format';
import { adminList } from '@/lib/repo';

export default async function CancellationsPage() {
  const rows = await adminList('cancellations');
  return (
    <div>
      <h1 className="text-3xl">Pembatalan</h1>
      <div className="table-wrap mt-4 card">
        <table>
          <thead><tr><th>Pesanan</th><th>Oleh</th><th>Peran</th><th>Alasan</th><th>Catatan</th><th>Waktu</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.full_name}</td><td>{row.cancelled_by_role}</td><td>{row.reason}</td><td>{row.note}</td><td>{formatDate(row.cancelled_at)}</td></tr>)}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="mt-4 text-muted">Belum ada pembatalan.</p> : null}
    </div>
  );
}
