import { adminStats } from '@/lib/repo';
import { rupiah } from '@/lib/format';

export default async function ReportsPage() {
  const stats = await adminStats();
  return (
    <div>
      <h1 className="text-3xl">Laporan</h1>
      <p className="mt-2 text-muted">Ringkasan dihitung dari pesanan yang tersimpan. Nilai transaksi adalah jumlah pesanan selesai, dibayar tunai saat layanan.</p>
      <ul className="mt-4 grid gap-2">
        <li className="card p-4">Selesai {stats.kpi.completed_tx} · nilai {rupiah(stats.kpi.value)}</li>
        <li className="card p-4">Aktif {stats.kpi.active_tx} · dibatalkan {stats.kpi.cancelled_tx}</li>
        <li className="card p-4">Komplain terbuka {stats.kpi.open_complaints}</li>
      </ul>
    </div>
  );
}
