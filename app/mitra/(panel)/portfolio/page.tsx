import { deletePortfolioAction } from '@/app/actions';
import { PortfolioForm } from '@/components/mitra-forms';
import { requireActor } from '@/lib/guard';
import { listPortfolio, providerServices } from '@/lib/repo';

export default async function PortfolioPage() {
  const actor = await requireActor('provider');
  const [items, services] = await Promise.all([listPortfolio(actor), providerServices(actor)]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-3xl">Portofolio</h1>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {items.map((item) => (
            <figure key={item.id} className="card overflow-hidden">
              <img src={item.image_url} alt={item.caption} className="h-32 w-full object-cover" />
              <figcaption className="p-3 text-sm">{item.caption}</figcaption>
              <form action={deletePortfolioAction} className="px-3 pb-3"><input type="hidden" name="id" value={item.id} /><button className="btn">Hapus</button></form>
            </figure>
          ))}
        </div>
      </div>
      <PortfolioForm services={services.map((item) => ({ id: item.id, name: item.name }))} />
    </div>
  );
}
