import { AdminShell } from '@/components/admin-shell';
import { requireActor } from '@/lib/guard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor('admin');
  return <AdminShell name={actor.fullName}>{children}</AdminShell>;
}
