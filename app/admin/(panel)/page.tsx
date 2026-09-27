import { adminStats } from '@/lib/repo';
import { rupiah } from '@/lib/format';

export default async function AdminHome() {
  const stats = await adminStats();
  const kpi = stats.kpi;
  const cards: [string, string | number][] = [
    ['Total pengguna', kpi.users],
    ['Pelanggan aktif', kpi.customers],
    ['Mitra aktif', kpi.providers],
    ['Mitra menunggu', kpi.pending_providers],
    ['Pesanan hari ini', kpi.bookings_today],
    ['Pesanan bulan ini', kpi.bookings_month],
    ['Transaksi aktif', kpi.active_tx],
    ['Transaksi selesai', kpi.completed_tx],
    ['Dibatalkan', kpi.cancelled_tx],
    ['Komplain terbuka', kpi.open_complaints],
    ['Nilai transaksi', rupiah(kpi.value)],
  ];
  const maxDaily = Math.max(1, ...stats.daily.map((row) => Number(row.count)));
  return (
    <div>
      <h1 className="text-3xl">Dasbor</h1>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => <article key={label} className="card p-4"><p className="text-sm text-muted">{label}</p><p className="text-2xl font-bold">{value}</p></article>)}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h2 className="text-xl">Pesanan 14 hari</h2>
          <div className="mt-3 flex h-36 items-end gap-2">
            {stats.daily.map((row) => <div key={row.label} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t bg-leaf" style={{ height: `${(Number(row.count) / maxDaily) * 100}%` }} /><span className="text-[10px] text-muted">{row.label}</span></div>)}
            {!stats.daily.length ? <p className="text-sm text-muted">Belum ada pesanan pada rentang ini.</p> : null}
          </div>
        </section>
        <section className="card p-4">
          <h2 className="text-xl">Status</h2>
          <ul className="mt-2 text-sm">{stats.byStatus.map((row) => <li key={row.status} className="flex justify-between border-b border-line py-1"><span>{row.status}</span><strong>{row.count}</strong></li>)}</ul>
        </section>
        <section className="card p-4 lg:col-span-3">
          <h2 className="text-xl">Mitra per kategori</h2>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">{stats.byCategory.map((row) => <li key={row.name} className="flex justify-between text-sm"><span>{row.name}</span><strong>{row.count}</strong></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
