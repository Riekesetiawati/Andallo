import { Footer, Header } from '@/components/chrome';
import { Dash, providerLinks } from '@/components/dash';
import { requireActor } from '@/lib/guard';
import { unreadCount } from '@/lib/repo';

export default async function MitraLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor('provider');
  const unread = await unreadCount(actor);
  return (
    <>
      <Header user={{ name: actor.fullName, role: actor.role }} unread={unread} />
      <Dash title="Mitra" links={providerLinks}>{children}</Dash>
      <Footer />
    </>
  );
}
