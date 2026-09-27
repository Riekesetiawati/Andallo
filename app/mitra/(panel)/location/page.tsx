import { LeafletMap } from '@/components/map';
import { requireActor } from '@/lib/guard';
import { myProvider } from '@/lib/repo';

export default async function LocationPage() {
  const actor = await requireActor('provider');
  const provider = await myProvider(actor);
  if (!provider) return <p>Profil belum ada.</p>;
  return (
    <div>
      <h1 className="text-3xl">Lokasi usaha</h1>
      <p className="text-sm text-muted">{provider.address}, {provider.city}. Radius {provider.service_radius_km} km. Ubah titik di halaman profil.</p>
      <div className="mt-4 h-80"><LeafletMap center={{ lat: Number(provider.lat), lng: Number(provider.lng) }} markers={[{ lat: Number(provider.lat), lng: Number(provider.lng), label: provider.business_name }]} /></div>
      <p className="mt-3 text-sm">Lokasi perjalanan dibagikan dari halaman pesanan saat Anda menekan Mulai perjalanan. Izin browser wajib.</p>
    </div>
  );
}
