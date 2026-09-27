import Link from 'next/link';
import { clearCompareAction } from '@/app/actions';
import { compareServices } from '@/lib/catalog';
import { getActor } from '@/lib/session';

export async function CompareDock() {
  const actor = await getActor();
  if (!actor || actor.role !== 'customer') return null;
  const items = await compareServices(actor);
  if (!items.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white">
      <div className="container flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="font-bold">{items.length} / 3 penyedia dipilih</p>
        <div className="flex gap-2">
          <form action={clearCompareAction}><button className="btn" type="submit">Hapus Semua</button></form>
          <Link className="btn btn-primary" href="/bandingkan">Bandingkan Sekarang</Link>
        </div>
      </div>
    </div>
  );
}
