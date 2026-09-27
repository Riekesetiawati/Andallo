import { ComplaintForm } from '@/components/complaint-form';
import { requireActor } from '@/lib/guard';

export default async function MitraNewComplaint({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  await requireActor('provider');
  const booking = (await searchParams).booking || '';
  if (!booking) return <p>Buka dari detail pesanan.</p>;
  return <ComplaintForm bookingId={booking} />;
}
