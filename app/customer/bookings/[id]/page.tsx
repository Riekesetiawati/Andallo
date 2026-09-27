import { notFound } from 'next/navigation';
import { BookingDetail } from '@/components/booking-detail';
import { requireActor } from '@/lib/guard';
import { getBooking } from '@/lib/repo';

export default async function CustomerBookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor('customer');
  const data = await getBooking(actor, (await params).id);
  if (!data) notFound();
  return <BookingDetail data={data} role="customer" />;
}
