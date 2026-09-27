import Link from 'next/link';
import { Empty } from '@/components/chrome';
import { formatDate, rupiah, STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { listBookings } from '@/lib/repo';

export default async function CustomerBookings() {
  const actor = await requireActor('customer');
  const rows = await listBookings(actor);
  if (!rows.length) return <Empty title="Belum ada pesanan" text="Pesanan yang Anda kirim akan tampil di sini." action={<Link className="btn btn-primary" href="/jasa">Cari jasa</Link>} />;
  return (
    <div>
      <h1 className="text-3xl">Pesanan saya</h1>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <Link key={row.id} href={`/customer/bookings/${row.id}`} className="card grid gap-1 p-4 md:grid-cols-[1fr_auto]">
            <div>
              <p className="font-bold">{row.code} · {row.service_name}</p>
              <p className="text-sm text-muted">{row.business_name} · {formatDate(row.booking_date)} {row.time_slot}</p>
            </div>
            <div className="text-sm md:text-right"><span className="badge">{STATUS_LABEL[row.status] || row.status}</span><p className="mt-1">{rupiah(row.amount)}</p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
