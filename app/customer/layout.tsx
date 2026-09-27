import { Footer, Header } from '@/components/chrome';
import { Dash, customerLinks } from '@/components/dash';
import { requireActor } from '@/lib/guard';
import { unreadCount } from '@/lib/repo';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor('customer');
  const unread = await unreadCount(actor);
  return (
    <>
      <Header user={{ name: actor.fullName, role: actor.role }} unread={unread} />
      <Dash title="Pelanggan" links={customerLinks}>{children}</Dash>
      <Footer />
    </>
  );
}
