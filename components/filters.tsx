'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Category = { slug: string; name: string };
type Defaults = Record<string, string | undefined>;

export function Filters({ defaults, categories, today, tomorrow }: { defaults: Defaults; categories: Category[]; today: string; tomorrow: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selected = new Set((defaults.category || '').split(',').filter(Boolean));
  const [minPrice, setMinPrice] = useState(Number(defaults.minPrice || 25000));
  const [maxPrice, setMaxPrice] = useState(Number(defaults.maxPrice || 500000));

  useEffect(() => {
    if (defaults.use !== 'geo' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const params = new URLSearchParams(window.location.search);
      params.set('lat', String(position.coords.latitude));
      params.set('lng', String(position.coords.longitude));
      params.set('radius', params.get('radius') || '10');
      params.delete('use');
      router.replace(`/jasa?${params.toString()}`);
    });
  }, [defaults.use, router]);

  function push(form: HTMLFormElement) {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (key === 'category') continue;
      if (String(value)) params.set(key, String(value));
    }
    const cats = [...form.querySelectorAll<HTMLInputElement>('input[name=category]:checked')].map((node) => node.value);
    if (cats.length) params.set('category', cats.join(','));
    params.set('minPrice', String(minPrice));
    params.set('maxPrice', String(maxPrice));
    router.push(`/jasa?${params.toString()}`);
  }

  return (
    <form
      id="filters"
      className={`${open ? 'fixed inset-0 z-40 overflow-auto bg-sand p-4' : 'hidden'} md:static md:block md:bg-transparent md:p-0`}
      onChange={(event) => {
        const target = event.target as unknown as { name?: string };
        if (target.name === 'q') return;
        push(event.currentTarget);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        push(event.currentTarget);
        setOpen(false);
      }}
    >
      <div className="card grid gap-4 p-4">
        <div className="flex items-center justify-between md:hidden"><strong>Filter</strong><button type="button" className="btn" onClick={() => setOpen(false)}>Tutup</button></div>
        <label className="field">Cari<input className="input" name="q" defaultValue={defaults.q || ''} placeholder="Nama jasa atau mitra" onChange={(event) => {
          const form = event.currentTarget.form;
          window.clearTimeout((form as HTMLFormElement & { _t?: number })._t);
          (form as HTMLFormElement & { _t?: number })._t = window.setTimeout(() => form && push(form), 350);
        }} /></label>
        <fieldset>
          <legend className="mb-2 font-bold">Kategori</legend>
          <div className="grid gap-1">
            {categories.map((category) => (
              <label key={category.slug} className="flex gap-2 text-sm"><input type="checkbox" name="category" value={category.slug} defaultChecked={selected.has(category.slug)} />{category.name}</label>
            ))}
          </div>
        </fieldset>
        <label className="field">Kota<input className="input" name="city" defaultValue={defaults.city || ''} placeholder="Bekasi" /></label>
        <input type="hidden" name="lat" defaultValue={defaults.lat || ''} />
        <input type="hidden" name="lng" defaultValue={defaults.lng || ''} />
        <label className="field">Jarak
          <select className="select" name="radius" defaultValue={defaults.radius || ''}>
            <option value="">Semua jarak</option>
            {['2', '5', '10', '20', '50'].map((km) => <option key={km} value={km}>≤ {km} km</option>)}
          </select>
        </label>
        <div>
          <p className="font-bold">Harga</p>
          <input type="range" min={25000} max={500000} step={5000} value={minPrice} onChange={(event) => setMinPrice(Math.min(Number(event.target.value), maxPrice))} aria-label="Harga minimum" />
          <input type="range" min={25000} max={500000} step={5000} value={maxPrice} onChange={(event) => setMaxPrice(Math.max(Number(event.target.value), minPrice))} aria-label="Harga maksimum" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="field">Harga minimum<input className="input" type="number" value={minPrice} onChange={(event) => setMinPrice(Number(event.target.value))} /></label>
            <label className="field">Harga maksimum<input className="input" type="number" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} /></label>
          </div>
        </div>
        <label className="field">Rating
          <select className="select" name="rating" defaultValue={defaults.rating || ''}>
            <option value="">Semua rating</option>
            <option value="4">≥ 4.0</option>
            <option value="4.5">≥ 4.5</option>
            <option value="4.8">≥ 4.8</option>
          </select>
        </label>
        <label className="field">Ketersediaan
          <select className="select" name="date" defaultValue={defaults.date || ''}>
            <option value="">Semua tanggal</option>
            <option value={today}>Hari ini</option>
            <option value={tomorrow}>Besok</option>
          </select>
        </label>
        <label className="field">Cara layanan
          <select className="select" name="method" defaultValue={defaults.method || ''}>
            <option value="">Semua</option>
            <option value="HOME_SERVICE">Ke lokasi pelanggan</option>
            <option value="AT_PROVIDER">Di tempat mitra</option>
            <option value="BOTH">Keduanya</option>
          </select>
        </label>
        <label className="field">Urutkan
          <select className="select" name="sort" defaultValue={defaults.sort || (defaults.lat ? 'distance' : 'rating')}>
            <option value="distance">Lokasi terdekat</option>
            <option value="price_asc">Harga termurah</option>
            <option value="price_desc">Harga tertinggi</option>
            <option value="rating">Rating tertinggi</option>
            <option value="reviews">Ulasan terbanyak</option>
            <option value="newest">Terbaru</option>
          </select>
        </label>
        <button className="btn btn-pine" type="submit">Terapkan</button>
        <a className="btn" href="/jasa">Reset filter</a>
        <button className="btn" type="button" onClick={() => {
          navigator.geolocation?.getCurrentPosition((position) => {
            const params = new URLSearchParams(window.location.search);
            params.set('lat', String(position.coords.latitude));
            params.set('lng', String(position.coords.longitude));
            params.set('radius', '10');
            params.set('sort', 'distance');
            router.push(`/jasa?${params.toString()}`);
          });
        }}>Gunakan Lokasi Saya</button>
      </div>
      <button className="btn btn-pine fixed bottom-4 right-4 z-30 md:hidden" type="button" onClick={() => setOpen(true)}>Filter</button>
    </form>
  );
}
