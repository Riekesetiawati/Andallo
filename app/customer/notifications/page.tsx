import Link from 'next/link';
import { readNotificationsAction } from '@/app/actions';
import { Empty } from '@/components/chrome';
import { requireActor } from '@/lib/guard';
import { notificationsFor } from '@/lib/repo';

function hrefFor(note: { entity_type: string | null; entity_id: string | null }) {
  if (note.entity_type === 'booking' && note.entity_id) return `/customer/bookings/${note.entity_id}`;
  if (note.entity_type === 'chat' && note.entity_id) return `/customer/chat?thread=${note.entity_id}`;
  if (note.entity_type === 'complaint' && note.entity_id) return `/customer/complaints/${note.entity_id}`;
  return '/customer/notifications';
}

export default async function CustomerNotifications() {
  const actor = await requireActor('customer');
  const rows = await notificationsFor(actor);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Notifikasi</h1>
        <form action={readNotificationsAction}><button className="btn">Tandai semua dibaca</button></form>
      </div>
      {!rows.length ? <div className="mt-4"><Empty title="Belum ada notifikasi" text="Pembaruan pesanan, chat, dan komplain muncul di sini." /></div> : (
        <div className="mt-4 grid gap-2">
          {rows.map((row) => (
            <Link key={row.id} href={hrefFor(row)} className={`card block p-4 ${row.read_at ? '' : 'border-leaf'}`}>
              <p className="font-bold">{row.title}</p>
              <p className="text-sm">{row.message}</p>
              <p className="text-xs text-muted">{new Date(row.created_at).toLocaleString('id-ID')}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
