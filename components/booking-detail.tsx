import Link from 'next/link';
import { cancelAction, reviewAction, statusAction } from '@/app/actions';
import { STATUS_LABEL, formatDate, rupiah } from '@/lib/format';
import { Countdown } from './countdown';
import { TrackMap } from './track';

const flow = ['WAITING_APPROVAL', 'ACCEPTED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'ON_PROGRESS', 'COMPLETED'];

export function BookingDetail({ data, role }: { data: { booking: Record<string, unknown>; history: { status: string; created_at: string }[]; location: { lat: number; lng: number; recorded_at: string } | null; cancellation: { reason: string; note: string } | null }; role: 'customer' | 'provider' | 'admin' }) {
  const booking = data.booking;
  const status = String(booking.status);
  const back = role === 'provider' ? '/mitra/bookings' : '/customer/bookings';
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">{String(booking.code)}</h1>
          <p>{String(booking.service_name)} · {String(booking.business_name)}</p>
        </div>
        <span className="badge">{STATUS_LABEL[status] || status}</span>
      </div>
      {status === 'WAITING_APPROVAL' && booking.approval_expires_at ? <Countdown expiresAt={String(booking.approval_expires_at)} /> : null}
      <ol className="grid gap-2 md:grid-cols-6">
        {flow.map((step) => (
          <li key={step} className={`rounded-2xl px-3 py-2 text-sm ${flow.indexOf(status) >= flow.indexOf(step) ? 'bg-mint font-bold' : 'bg-white'}`}>{STATUS_LABEL[step]}</li>
        ))}
      </ol>
      <div className="card grid gap-2 p-4 text-sm">
        <p>Tanggal {formatDate(String(booking.booking_date))} · {String(booking.time_slot)}</p>
        <p>Paket {String(booking.package_name)} · {rupiah(Number(booking.amount))}</p>
        <p>Alamat {String(booking.address)}</p>
        <p>Pembayaran {String(booking.payment_status || 'UNPAID')} · tunai saat layanan</p>
        {booking.notes ? <p>Catatan {String(booking.notes)}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {role === 'provider' && status === 'WAITING_APPROVAL' ? (
          <>
            <form action={statusAction}><input type="hidden" name="id" value={String(booking.id)} /><input type="hidden" name="status" value="ACCEPTED" /><input type="hidden" name="back" value={`/mitra/bookings/${booking.id}`} /><button className="btn btn-primary">Terima</button></form>
            <form action={statusAction}><input type="hidden" name="id" value={String(booking.id)} /><input type="hidden" name="status" value="REJECTED" /><input type="hidden" name="back" value={`/mitra/bookings/${booking.id}`} /><button className="btn">Tolak</button></form>
          </>
        ) : null}
        {role === 'provider' && ['ACCEPTED', 'CONFIRMED'].includes(status) ? <form action={statusAction}><input type="hidden" name="id" value={String(booking.id)} /><input type="hidden" name="status" value="PROVIDER_ON_THE_WAY" /><input type="hidden" name="back" value={`/mitra/bookings/${booking.id}`} /><button className="btn btn-pine">Mulai perjalanan</button></form> : null}
        {role === 'provider' && status === 'PROVIDER_ON_THE_WAY' ? <form action={statusAction}><input type="hidden" name="id" value={String(booking.id)} /><input type="hidden" name="status" value="ARRIVED" /><input type="hidden" name="back" value={`/mitra/bookings/${booking.id}`} /><button className="btn btn-pine">Saya tiba</button></form> : null}
        {role === 'provider' && status === 'ARRIVED' ? <form action={statusAction}><input type="hidden" name="id" value={String(booking.id)} /><input type="hidden" name="status" value="ON_PROGRESS" /><input type="hidden" name="back" value={`/mitra/bookings/${booking.id}`} /><button className="btn btn-pine">Mulai kerja</button></form> : null}
        {role === 'provider' && status === 'ON_PROGRESS' ? <form action={statusAction}><input type="hidden" name="id" value={String(booking.id)} /><input type="hidden" name="status" value="COMPLETED" /><input type="hidden" name="back" value={`/mitra/bookings/${booking.id}`} /><button className="btn btn-primary">Selesai</button></form> : null}
        <Link className="btn" href={`${role === 'provider' ? '/mitra' : '/customer'}/chat?thread=${booking.thread_id}`}>Chat</Link>
        <Link className="btn" href={`${role === 'provider' ? '/mitra' : '/customer'}/complaints/new?booking=${booking.id}`}>Ajukan komplain</Link>
      </div>
      {role === 'provider' && status === 'PROVIDER_ON_THE_WAY' ? <TrackMap bookingId={String(booking.id)} share role="provider" provider={{ lat: Number(booking.provider_lat), lng: Number(booking.provider_lng) }} customer={null} initial={data.location} /> : null}
      {role === 'customer' && status === 'PROVIDER_ON_THE_WAY' ? <TrackMap bookingId={String(booking.id)} role="customer" provider={{ lat: Number(booking.provider_lat), lng: Number(booking.provider_lng) }} customer={null} initial={data.location} /> : null}
      {['WAITING_APPROVAL', 'ACCEPTED', 'CONFIRMED'].includes(status) && role !== 'admin' ? (
        <form action={cancelAction} className="card grid gap-2 p-4">
          <h2 className="text-xl">Batalkan pesanan</h2>
          <input type="hidden" name="id" value={String(booking.id)} />
          <input type="hidden" name="back" value={back} />
          <select className="select" name="reason">
            {['Salah jadwal', 'Menemukan penyedia lain', 'Penyedia terlambat', 'Perubahan kebutuhan', 'Lainnya'].map((reason) => <option key={reason}>{reason}</option>)}
          </select>
          <textarea className="input" name="note" placeholder="Catatan" />
          <button className="btn">Batalkan pesanan</button>
        </form>
      ) : null}
      {data.cancellation ? <p className="text-sm">Dibatalkan: {data.cancellation.reason}. {data.cancellation.note}</p> : null}
      {role === 'customer' && status === 'COMPLETED' && !booking.reviewed ? (
        <form action={reviewAction} className="card grid gap-2 p-4">
          <h2 className="text-xl">Beri rating</h2>
          <input type="hidden" name="bookingId" value={String(booking.id)} />
          <input type="hidden" name="slug" value={String(booking.slug)} />
          <select className="select" name="rating">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} bintang</option>)}</select>
          <textarea className="input" name="comment" required minLength={5} placeholder="Bagaimana layanannya?" />
          <button className="btn btn-primary">Kirim ulasan</button>
        </form>
      ) : null}
      <ol className="text-sm text-muted">{data.history.map((item) => <li key={item.created_at}>{formatDate(item.created_at)} · {STATUS_LABEL[item.status] || item.status}</li>)}</ol>
    </div>
  );
}
