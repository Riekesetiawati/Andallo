import { archiveServiceAction } from '@/app/actions';
import { ServiceForm } from '@/components/mitra-forms';
import { listCategories } from '@/lib/catalog';
import { requireActor } from '@/lib/guard';
import { providerServices } from '@/lib/repo';

export default async function ServicesPage() {
  const actor = await requireActor('provider');
  const [services, categories] = await Promise.all([providerServices(actor), listCategories()]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-3xl">Jasa saya</h1>
        <div className="mt-4 grid gap-3">
          {services.map((service) => (
            <article key={service.id} className="card p-4">
              <p className="font-bold">{service.name}</p>
              <p className="text-sm text-muted">{service.is_active ? 'Aktif' : 'Nonaktif'} · {service.duration_min} menit</p>
              <form action={archiveServiceAction} className="mt-2"><input type="hidden" name="id" value={service.id} /><button className="btn">Arsipkan</button></form>
            </article>
          ))}
        </div>
      </div>
      <ServiceForm categories={categories.map((item) => ({ id: item.id, name: item.name }))} />
    </div>
  );
}
