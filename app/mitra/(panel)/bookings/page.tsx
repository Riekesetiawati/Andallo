import Link from 'next/link';
import { Empty } from '@/components/chrome';
import { formatDate, rupiah, STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { listBookings } from '@/lib/repo';

export default async function MitraBookings() {
  const actor = await requireActor('provider');
  const rows = await listBookings(actor);
  if (!rows.length) return <Empty title="Belum ada pesanan" text="Pesanan pelanggan untuk usaha Anda tampil di sini." />;
  return (
    <div>
      <h1 className="text-3xl">Pesanan</h1>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <Link key={row.id} href={`/mitra/bookings/${row.id}`} className="card block p-4">
            <p className="font-bold">{row.code} · {row.customer_name}</p>
            <p className="text-sm text-muted">{row.service_name} · {formatDate(row.booking_date)} {row.time_slot} · {rupiah(row.amount)}</p>
            <span className="badge mt-2">{STATUS_LABEL[row.status] || row.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
