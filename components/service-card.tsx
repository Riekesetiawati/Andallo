import Link from 'next/link';
import { compareAction, favoriteAction } from '@/app/actions';
import { METHOD_LABEL, rupiah } from '@/lib/format';
import type { ServiceCard } from '@/lib/catalog';
import { Stars } from './chrome';

export function ServiceCardView({ service, favorite = false }: { service: ServiceCard; favorite?: boolean }) {
  return (
    <article className="card flex flex-col overflow-hidden">
      <Link href={`/provider/${service.slug}`} className="relative block aspect-[16/10] bg-mint">
        {service.imageUrl ? <img src={service.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
        <span className="badge absolute left-3 top-3">Terverifikasi</span>
      </Link>
      <div className="grid flex-1 gap-2 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{service.categoryName} · {service.city}</p>
        <h3 className="text-xl leading-tight"><Link href={`/provider/${service.slug}`}>{service.businessName}</Link></h3>
        <p className="font-semibold">{service.name}</p>
        <Stars rating={service.rating} count={service.reviewCount} />
        <p className="text-sm text-muted">{service.distanceKm == null ? METHOD_LABEL[service.serviceMethod] : `${service.distanceKm} km dari kamu`}</p>
        <p className="text-sm">Mulai <strong>{rupiah(service.minPrice)}</strong></p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Link className="btn" href={`/provider/${service.slug}`}>Detail</Link>
          <form action={compareAction}><input type="hidden" name="serviceId" value={service.id} /><button className="btn" type="submit">Bandingkan</button></form>
          <Link className="btn btn-primary" href={`/pesan/${service.id}`}>Pesan</Link>
          {favorite ? (
            <form action={favoriteAction}><input type="hidden" name="providerId" value={service.providerId} /><button className="btn btn-ghost" type="submit" aria-label="Favorit">♡</button></form>
          ) : null}
        </div>
      </div>
    </article>
  );
}
