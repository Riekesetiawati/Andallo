import Link from 'next/link';
import { readNotificationsAction } from '@/app/actions';
import { requireActor } from '@/lib/guard';
import { notificationsFor } from '@/lib/repo';

export default async function MitraNotes() {
  const actor = await requireActor('provider');
  const rows = await notificationsFor(actor);
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-3xl">Notifikasi</h1><form action={readNotificationsAction}><button className="btn">Tandai semua dibaca</button></form></div>
      <div className="mt-4 grid gap-2">
        {rows.map((row) => {
          const href = row.entity_type === 'booking' && row.entity_id ? `/mitra/bookings/${row.entity_id}` : row.entity_type === 'chat' ? `/mitra/chat?thread=${row.entity_id}` : '/mitra/notifications';
          return <Link key={row.id} href={href} className="card block p-4"><p className="font-bold">{row.title}</p><p className="text-sm">{row.message}</p></Link>;
        })}
        {!rows.length ? <p className="text-muted">Belum ada notifikasi.</p> : null}
      </div>
    </div>
  );
}
