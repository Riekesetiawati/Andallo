import { ComplaintForm } from '@/components/complaint-form';
import { requireActor } from '@/lib/guard';

export default async function NewComplaint({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  await requireActor('customer');
  const booking = (await searchParams).booking || '';
  if (!booking) return <p>Pilih pesanan dari halaman detail untuk mengajukan komplain.</p>;
  return (
    <div className="max-w-xl">
      <h1 className="text-3xl">Ajukan komplain</h1>
      <div className="mt-4"><ComplaintForm bookingId={booking} /></div>
    </div>
  );
}
