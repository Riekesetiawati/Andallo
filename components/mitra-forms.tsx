'use client';

import { useActionState } from 'react';
import { bankAction, carouselAction, categoryAction, highlightAction, packageAction, portfolioAction, providerProfileAction, serviceAction } from '@/app/actions';
import { UploadField } from './upload-field';
import { LeafletMap } from './map';
import { useState } from 'react';

function Alert({ state }: { state: { error?: string; ok?: boolean } | null }) {
  if (state?.error) return <p className="text-sm font-semibold text-red-700">{state.error}</p>;
  if (state?.ok) return <p className="text-sm font-semibold text-leaf">Tersimpan.</p>;
  return null;
}

export function ServiceForm({ categories, service }: { categories: { id: string; name: string }[]; service?: { id: string; name: string; category_id: string; description: string; duration_min: number; service_method: string; is_active: boolean } }) {
  const [state, action, pending] = useActionState(serviceAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4">
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <label className="field">Nama jasa<input className="input" name="name" required defaultValue={service?.name} /></label>
      <label className="field">Kategori<select className="select" name="categoryId" defaultValue={service?.category_id}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field">Deskripsi<textarea className="input min-h-24" name="description" required defaultValue={service?.description} /></label>
      <label className="field">Durasi (menit)<input className="input" name="duration" type="number" min={15} defaultValue={service?.duration_min || 60} /></label>
      <label className="field">Metode
        <select className="select" name="method" defaultValue={service?.service_method || 'BOTH'}>
          <option value="HOME_SERVICE">Ke lokasi pelanggan</option>
          <option value="AT_PROVIDER">Di tempat mitra</option>
          <option value="BOTH">Keduanya</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={service ? service.is_active : true} /> Aktif</label>
      <Alert state={state} />
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Menyimpan...' : 'Simpan jasa'}</button>
    </form>
  );
}

export function PackageForm({ services }: { services: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(packageAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4">
      <label className="field">Jasa<select className="select" name="serviceId">{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field">Nama paket<input className="input" name="name" required /></label>
      <label className="field">Deskripsi<input className="input" name="description" /></label>
      <label className="field">Harga<input className="input" name="price" type="number" min={0} required /></label>
      <label className="field">Durasi<input className="input" name="duration" type="number" min={15} defaultValue={60} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Aktif</label>
      <Alert state={state} />
      <button className="btn btn-primary" disabled={pending}>Tambah paket</button>
    </form>
  );
}

export function PortfolioForm({ services }: { services: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(portfolioAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4">
      <label className="field">Jasa terkait<select className="select" name="serviceId"><option value="">Umum</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field">Keterangan<input className="input" name="caption" required /></label>
      <UploadField name="imageUrl" bucket="portfolios" label="Foto" />
      <Alert state={state} />
      <button className="btn btn-primary" disabled={pending}>Unggah</button>
    </form>
  );
}

export function BankForm() {
  const [state, action, pending] = useActionState(bankAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4">
      <label className="field">Bank<input className="input" name="bankName" required /></label>
      <label className="field">Nomor rekening<input className="input" name="accountNumber" required /></label>
      <label className="field">Nama pemilik<input className="input" name="accountHolder" required /></label>
      <UploadField name="evidenceUrl" bucket="bank-verification" label="Bukti rekening" />
      <Alert state={state} />
      <button className="btn btn-primary" disabled={pending}>Ajukan verifikasi</button>
    </form>
  );
}

export function ProviderProfileForm({ profile }: { profile: Record<string, string | number | null> }) {
  const [state, action, pending] = useActionState(providerProfileAction, null);
  const [point, setPoint] = useState({ lat: Number(profile.lat) || -6.23, lng: Number(profile.lng) || 106.97 });
  return (
    <form action={action} className="grid gap-3">
      <label className="field">Nama usaha<input className="input" name="businessName" defaultValue={String(profile.business_name || '')} required /></label>
      <label className="field">Deskripsi<textarea className="input min-h-28" name="description" defaultValue={String(profile.description || '')} required /></label>
      <label className="field">Telepon<input className="input" name="phone" defaultValue={String(profile.phone || '')} /></label>
      <label className="field">Email usaha<input className="input" name="businessEmail" type="email" defaultValue={String(profile.business_email || '')} /></label>
      <label className="field">Alamat<input className="input" name="address" defaultValue={String(profile.address || '')} /></label>
      <label className="field">Kota<input className="input" name="city" defaultValue={String(profile.city || '')} /></label>
      <label className="field">Radius km<input className="input" name="radius" type="number" defaultValue={Number(profile.service_radius_km || 10)} /></label>
      <label className="field">Metode
        <select className="select" name="method" defaultValue={String(profile.service_method || 'BOTH')}>
          <option value="HOME_SERVICE">Ke lokasi pelanggan</option>
          <option value="AT_PROVIDER">Di tempat mitra</option>
          <option value="BOTH">Keduanya</option>
        </select>
      </label>
      <input type="hidden" name="lat" value={point.lat} />
      <input type="hidden" name="lng" value={point.lng} />
      <LeafletMap center={point} markers={[{ lat: point.lat, lng: point.lng, label: 'Lokasi' }]} onPick={(lat, lng) => setPoint({ lat, lng })} />
      <UploadField name="coverUrl" bucket="provider-covers" label="Sampul baru" />
      <Alert state={state} />
      <button className="btn btn-primary" disabled={pending}>Simpan profil</button>
    </form>
  );
}

export function HighlightForm({ providers }: { providers: { id: string; business_name: string }[] }) {
  const [state, action, pending] = useActionState(highlightAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4">
      <label className="field">Mitra<select className="select" name="providerId">{providers.map((item) => <option key={item.id} value={item.id}>{item.business_name}</option>)}</select></label>
      <label className="field">Judul<input className="input" name="headline" required /></label>
      <label className="field">Subjudul<input className="input" name="subtitle" /></label>
      <label className="field">URL banner<input className="input" name="banner" /></label>
      <label className="field">Teks tombol<input className="input" name="cta" defaultValue="Lihat mitra" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Aktif</label>
      <Alert state={state} />
      <button className="btn btn-primary" disabled={pending}>Simpan highlight</button>
    </form>
  );
}

export function CarouselForm() {
  const [state, action, pending] = useActionState(carouselAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4">
      <label className="field">Judul<input className="input" name="title" required /></label>
      <label className="field">Subjudul<input className="input" name="subtitle" /></label>
      <label className="field">URL gambar<input className="input" name="image" required /></label>
      <label className="field">Tautan<input className="input" name="link" defaultValue="/jasa" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Aktif</label>
      <Alert state={state} />
      <button className="btn btn-primary" disabled={pending}>Simpan slide</button>
    </form>
  );
}

export function CategoryForm() {
  const [state, action, pending] = useActionState(categoryAction, null);
  return (
    <form action={action} className="card grid gap-3 p-4">
      <label className="field">Nama<input className="input" name="name" required /></label>
      <label className="field">Ikon<input className="input" name="icon" defaultValue="sparkles" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked /> Aktif</label>
      <Alert state={state} />
      <button className="btn btn-primary" disabled={pending}>Tambah kategori</button>
    </form>
  );
}
