import Link from 'next/link';
import { formatDate, rupiah, STATUS_LABEL } from '@/lib/format';
import { adminList } from '@/lib/repo';

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const rows = (await adminList('bookings')).filter((row) => {
    if (query.status && row.status !== query.status) return false;
    if (query.q && !`${row.customer_name} ${row.business_name} ${row.service_name} ${row.code}`.toLowerCase().includes(query.q.toLowerCase())) return false;
    if (query.from && String(row.booking_date).slice(0, 10) < query.from) return false;
    if (query.to && String(row.booking_date).slice(0, 10) > query.to) return false;
    if (query.min && Number(row.amount) < Number(query.min)) return false;
    if (query.max && Number(row.amount) > Number(query.max)) return false;
    return true;
  });
  return (
    <div>
      <h1 className="text-3xl">Monitoring transaksi</h1>
      <form className="mt-4 grid gap-2 md:grid-cols-6">
        <input className="input" name="q" placeholder="Nama atau kode" defaultValue={query.q} />
        <input className="input" name="status" placeholder="Status" defaultValue={query.status} />
        <input className="input" type="date" name="from" defaultValue={query.from} aria-label="Dari tanggal" />
        <input className="input" type="date" name="to" defaultValue={query.to} aria-label="Sampai tanggal" />
        <input className="input" name="min" placeholder="Min" defaultValue={query.min} />
        <button className="btn btn-pine">Filter</button>
      </form>
      <div className="table-wrap mt-4 card">
        <table>
          <thead><tr><th>Kode</th><th>Pelanggan</th><th>Mitra</th><th>Nilai</th><th>Status</th><th>Dibuat</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id}><td><Link href={`/admin/bookings/${row.id}`} className="font-bold text-leaf">{row.code}</Link></td><td>{row.customer_name}</td><td>{row.business_name}</td><td>{rupiah(row.amount)}</td><td>{STATUS_LABEL[row.status]}</td><td>{formatDate(row.created_at)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
