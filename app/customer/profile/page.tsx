import { PhoneForm, ProfileForm } from '@/components/forms';
import { requireActor } from '@/lib/guard';

export default async function ProfilePage() {
  const actor = await requireActor('customer');
  return (
    <div className="grid max-w-xl gap-4">
      <ProfileForm name={actor.fullName} phone={actor.phone || ''} />
      <PhoneForm verified={Boolean(actor.phoneVerifiedAt)} />
      <p className="text-sm text-muted">{actor.emailVerifiedAt ? 'Email terverifikasi' : 'Email belum diverifikasi'} · {actor.email}</p>
    </div>
  );
}
