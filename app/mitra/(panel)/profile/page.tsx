import { ProviderProfileForm } from '@/components/mitra-forms';
import { requireActor } from '@/lib/guard';
import { myProvider } from '@/lib/repo';

export default async function MitraProfile() {
  const actor = await requireActor('provider');
  const provider = await myProvider(actor);
  if (!provider) return <p>Profil belum ada.</p>;
  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-3xl">Profil usaha</h1>
      <ProviderProfileForm profile={provider} />
    </div>
  );
}
