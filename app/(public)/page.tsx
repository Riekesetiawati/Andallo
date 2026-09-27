import Link from 'next/link';
import { homeData } from '@/lib/catalog';
import { ServiceCardView } from '@/components/service-card';
import { Stars } from '@/components/chrome';
import { Carousel } from '@/components/carousel';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ lat?: string; lng?: string; notice?: string }> }) {
  const params = await searchParams;
  const lat = params.lat ? Number(params.lat) : null;
  const lng = params.lng ? Number(params.lng) : null;
  const data = await homeData(lat, lng);
  return (
    <div>
      {params.notice ? <p className="container mt-4 rounded-2xl bg-orange/10 px-4 py-3 text-sm font-semibold">{params.notice}</p> : null}
      <section className="bg-pine text-white">
        <div className="container grid items-end gap-10 py-16 md:grid-cols-[1.3fr_0.7fr]">
          <div>
            <p className="text-sm font-bold text-orange">Andallo, jasa andalanmu setiap saat.</p>
            <h1 className="mt-3 max-w-[12ch] text-5xl leading-[1.02] md:text-6xl">Ada yang perlu dibantu? Andallo-in aja.</h1>
            <p className="mt-4 max-w-xl text-lg text-white/80">Temukan jasa, bandingkan harga, lihat rating dan ulasan, lalu pesan sesuai kebutuhanmu.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">Harga paket tertulis. Ulasan hanya dari pesanan yang selesai. Mitra baru tampil setelah admin meninjau.</div>
        </div>
      </section>
      <form action="/jasa" className="container -mt-8 grid gap-3 rounded-3xl border border-line bg-white p-4 shadow-lg md:grid-cols-[1.4fr_1fr_auto_auto]">
        <input className="input" name="q" placeholder="Cari jasa..." aria-label="Cari jasa" />
        <input className="input" name="city" placeholder="Lokasi layanan" aria-label="Lokasi layanan" />
        <GeoButton />
        <button className="btn btn-pine" type="submit">Cari Jasa</button>
      </form>

      {data.carousel.length ? <Carousel slides={data.carousel} /> : null}

      <section id="kategori" className="container mt-14">
        <h2 className="text-3xl">Kategori populer</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {data.categories.map((category) => (
            <Link key={category.id} href={`/jasa?category=${category.slug}`} className="card px-4 py-5 hover:border-leaf">
              <p className="font-bold">{category.name}</p>
              <p className="text-sm text-muted">{category.service_count} jasa</p>
            </Link>
          ))}
        </div>
      </section>

      <Section title={lat ? 'Jasa di dekatmu' : 'Paling banyak diulas'} href="/jasa">
        <Grid items={data.nearby} />
      </Section>
      <Section title="Mitra dengan rating tertinggi" href="/jasa?sort=rating">
        <Grid items={data.recommended} />
      </Section>

      {data.highlights.length ? (
        <section className="container mt-14">
          <h2 className="text-3xl">Pilihan admin</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {data.highlights.map((item) => (
              <Link key={item.id} href={`/provider/${item.slug}`} className="card overflow-hidden">
                {item.banner_url ? <img src={item.banner_url} alt="" className="h-36 w-full object-cover" /> : null}
                <div className="p-4">
                  <p className="text-sm text-muted">{item.business_name}</p>
                  <h3 className="text-2xl">{item.headline}</h3>
                  <p className="mt-1 text-sm text-muted">{item.subtitle}</p>
                  <span className="btn btn-primary mt-4">{item.cta_label}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="container mt-14 grid gap-4 md:grid-cols-3">
        {['Cari jasa di sekitar Anda', 'Bandingkan harga dan ulasan', 'Pesan, lalu pantau statusnya'].map((title, index) => (
          <article key={title} className="card p-5"><p className="text-sm font-bold text-leaf">0{index + 1}</p><h3 className="mt-2 text-2xl">{title}</h3></article>
        ))}
      </section>

      <section className="container mt-14">
        <h2 className="text-3xl">Cerita pelanggan</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {data.testimonials.map((item) => (
            <blockquote key={item.comment} className="card p-5">
              <Stars rating={Number(item.rating)} />
              <p className="mt-3">“{item.comment}”</p>
              <footer className="mt-3 text-sm text-muted">{item.full_name} · {item.business_name}</footer>
            </blockquote>
          ))}
        </div>
      </section>
    </div>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="container mt-14">
      <div className="mb-4 flex items-end justify-between gap-3"><h2 className="text-3xl">{title}</h2><Link href={href} className="text-sm font-bold text-leaf">Lihat semua</Link></div>
      {children}
    </section>
  );
}

function Grid({ items }: { items: Parameters<typeof ServiceCardView>[0]['service'][] }) {
  if (!items.length) return <p className="text-muted">Belum ada jasa untuk ditampilkan.</p>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{items.map((service) => <ServiceCardView key={service.id} service={service} favorite />)}</div>;
}

function GeoButton() {
  return (
    <Link href="/jasa?use=geo" className="btn">Gunakan Lokasi Saya</Link>
  );
}
