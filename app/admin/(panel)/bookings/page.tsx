import Link from 'next/link';
import { formatDate, rupiah, STATUS_LABEL } from '@/lib/format';
import { adminList } from '@/lib/repo';

export default async function AdminBookings() {
  const rows = await adminList('bookings');
  return (
    <div>
      <h1 className="text-3xl">Pesanan</h1>
      <div className="table-wrap mt-4 card">
        <table>
          <thead><tr><th>Kode</th><th>Pelanggan</th><th>Mitra</th><th>Jasa</th><th>Tanggal</th><th>Nilai</th><th>Bayar</th><th>Status</th><th>Komplain</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link className="font-bold text-leaf" href={`/admin/bookings/${row.id}`}>{row.code}</Link></td>
                <td>{row.customer_name}</td>
                <td>{row.business_name}</td>
                <td>{row.service_name}</td>
                <td>{formatDate(row.booking_date)} {row.time_slot}</td>
                <td>{rupiah(row.amount)}</td>
                <td>{STATUS_LABEL[row.payment_status] || row.payment_status}</td>
                <td>{STATUS_LABEL[row.status] || row.status}</td>
                <td>{row.has_complaint ? 'Ada' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
