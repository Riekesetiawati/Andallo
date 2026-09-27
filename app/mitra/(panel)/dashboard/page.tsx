import Link from 'next/link';
import { rupiah, STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { dashboardProvider } from '@/lib/repo';

export default async function MitraDashboard() {
  const actor = await requireActor('provider');
  const stats = await dashboardProvider(actor);
  if (!stats) return <p>Profil mitra belum ada.</p>;
  const cards = [
    ['Booking baru', stats.incoming],
    ['Booking aktif', stats.active],
    ['Booking selesai', stats.done],
    ['Pendapatan', rupiah(stats.earnings)],
    ['Rating', Number(stats.rating).toFixed(1)],
    ['Ulasan', stats.reviews],
  ];
  return (
    <div>
      <h1 className="text-3xl">{stats.provider.business_name}</h1>
      <p className="text-sm"><span className="badge">{STATUS_LABEL[stats.provider.status] || stats.provider.status}</span></p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([label, value]) => <article key={String(label)} className="card p-4"><p className="text-sm text-muted">{label}</p><p className="text-2xl font-bold">{value}</p></article>)}
      </div>
      <Link className="btn btn-primary mt-4" href="/mitra/bookings">Lihat pesanan</Link>
    </div>
  );
}
