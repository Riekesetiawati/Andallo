import { CompareDock } from '@/components/compare-dock';
import { Footer, Header, type HeaderUser } from '@/components/chrome';
import { getActor } from '@/lib/session';
import { unreadCount } from '@/lib/repo';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  const user: HeaderUser = actor ? { name: actor.fullName, role: actor.role } : null;
  const unread = actor ? await unreadCount(actor) : 0;
  return (
    <>
      <Header user={user} unread={unread} />
      <main className="flex-1 pb-24">{children}</main>
      <CompareDock />
      <Footer />
    </>
  );
}
