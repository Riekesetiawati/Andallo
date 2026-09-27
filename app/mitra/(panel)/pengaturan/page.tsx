import { PasswordForm, PhoneForm } from '@/components/forms';
import { requireActor } from '@/lib/guard';

export default async function MitraSettings() {
  const actor = await requireActor('provider');
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="text-3xl">Pengaturan</h1>
      <p className="text-sm text-muted">{actor.email} · {actor.emailVerifiedAt ? 'Email terverifikasi' : 'Email belum diverifikasi'}</p>
      <PasswordForm />
      <PhoneForm verified={Boolean(actor.phoneVerifiedAt)} />
    </div>
  );
}
