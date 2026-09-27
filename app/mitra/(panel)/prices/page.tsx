import { PackageForm } from '@/components/mitra-forms';
import { rupiah } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { providerServices } from '@/lib/repo';

export default async function PricesPage() {
  const actor = await requireActor('provider');
  const services = await providerServices(actor);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-3xl">Harga dan paket</h1>
        {services.map((service) => (
          <section key={service.id} className="mt-4">
            <h2 className="text-xl">{service.name}</h2>
            {(service.packages || []).map((pkg: { id: string; name: string; price: number; active: boolean }) => (
              <p key={pkg.id} className="text-sm">{pkg.name} · {rupiah(pkg.price)} · {pkg.active ? 'aktif' : 'nonaktif'}</p>
            ))}
          </section>
        ))}
      </div>
      <PackageForm services={services.map((item) => ({ id: item.id, name: item.name }))} />
    </div>
  );
}
