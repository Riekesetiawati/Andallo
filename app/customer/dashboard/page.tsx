import Link from 'next/link';
import { Empty } from '@/components/chrome';
import { formatDate, STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { dashboardCustomer, listBookings } from '@/lib/repo';

export default async function CustomerDashboard() {
  const actor = await requireActor('customer');
  const [stats, bookings] = await Promise.all([dashboardCustomer(actor), listBookings(actor)]);
  const upcoming = bookings.find((row) => ['WAITING_APPROVAL', 'ACCEPTED', 'CONFIRMED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'ON_PROGRESS'].includes(row.status));
  const cards = [
    ['Pesanan aktif', stats.active],
    ['Pesanan selesai', stats.done],
    ['Favorit', stats.favorites],
    ['Komplain aktif', stats.complaints],
  ];
  return (
    <div>
      <h1 className="text-3xl">Halo, {actor.fullName.split(' ')[0]}</h1>
      <p className="text-sm text-muted">{actor.emailVerifiedAt ? 'Email terverifikasi' : 'Email belum diverifikasi'} · {actor.phoneVerifiedAt ? 'Telepon terverifikasi' : 'Telepon belum diverifikasi'}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => <article key={String(label)} className="card p-4"><p className="text-sm text-muted">{label}</p><p className="text-3xl font-bold">{value}</p></article>)}
      </div>
      <section className="mt-6">
        <h2 className="text-2xl">Pesanan mendatang</h2>
        {upcoming ? (
          <Link href={`/customer/bookings/${upcoming.id}`} className="card mt-3 block p-4">
            <p className="font-bold">{upcoming.code} · {upcoming.service_name}</p>
            <p className="text-sm text-muted">{upcoming.business_name} · {formatDate(upcoming.booking_date)} {upcoming.time_slot} · {STATUS_LABEL[upcoming.status]}</p>
          </Link>
        ) : <div className="mt-3"><Empty title="Belum ada pesanan" text="Cari jasa di sekitar Anda dan kirim pesanan." action={<Link className="btn btn-primary" href="/jasa">Cari jasa</Link>} /></div>}
      </section>
    </div>
  );
}
