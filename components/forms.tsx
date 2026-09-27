'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { bookAction, confirmPhoneAction, forgotAction, loginAction, passwordAction, phoneOtpAction, profileAction, providerRegisterAction, registerAction, resetAction, supportAction } from '@/app/actions';
import { LeafletMap } from './map';

export function LoginForm({ next = '', intent = '' }: { next?: string; intent?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="card mx-auto grid w-full max-w-md gap-3 p-6">
      <img src="/andallo-logo.png" alt="" className="h-12 w-12 rounded-full" />
      <h1 className="text-3xl">{intent === 'admin' ? 'Masuk admin' : 'Masuk'}</h1>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="intent" value={intent} />
      <label className="field">Email<input className="input" name="email" type="email" required autoComplete="username" /></label>
      <label className="field">Kata sandi<input className="input" name="password" type="password" required autoComplete="current-password" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remember" /> Ingat saya di perangkat ini</label>
      {state?.error ? <p className="text-sm font-semibold text-red-700" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Memproses...' : 'Masuk'}</button>
      <p className="text-sm"><Link href="/forgot-password">Lupa password</Link> · <Link href="/register">Daftar</Link></p>
      <p className="text-xs text-muted">Demo: rieke@andallo.com, mitra@andallo.com, admin@andallo.com · kata sandi demo123</p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, null);
  if (state && 'verifyPath' in state && (state.verifyPath || state.error === '')) {
    return <div className="card mx-auto max-w-md p-6"><h1 className="text-3xl">Cek email Anda</h1><p className="mt-2">Akun dibuat. Verifikasi email sebelum memesan.</p>{state.verifyPath ? <p className="mt-3 text-sm">Mode pengembangan, email belum terhubung. <Link className="font-bold text-leaf" href={state.verifyPath}>Buka tautan verifikasi</Link></p> : null}</div>;
  }
  return (
    <form action={action} className="card mx-auto grid w-full max-w-md gap-3 p-6">
      <h1 className="text-3xl">Daftar</h1>
      <label className="field">Nama lengkap<input className="input" name="name" required minLength={3} /></label>
      <label className="field">Email<input className="input" name="email" type="email" required /></label>
      <label className="field">Nomor telepon<input className="input" name="phone" required placeholder="08xxxxxxxxxx" /></label>
      <label className="field">Kata sandi<input className="input" name="password" type="password" required minLength={8} /></label>
      <label className="field">Konfirmasi kata sandi<input className="input" name="confirm" type="password" required /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="terms" required /> Saya setuju dengan syarat layanan dan privasi Andallo.</label>
      {state?.error ? <p className="text-sm font-semibold text-red-700" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Memproses...' : 'Daftar'}</button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotAction, null);
  return (
    <form action={action} className="card mx-auto grid w-full max-w-md gap-3 p-6">
      <h1 className="text-3xl">Lupa password</h1>
      <label className="field">Email<input className="input" name="email" type="email" required /></label>
      {state?.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      {state?.sent ? <p className="text-sm">Jika email terdaftar, tautan reset sudah dibuat. {state.path ? <Link className="font-bold text-leaf" href={state.path}>Buka tautan reset</Link> : 'Cek kotak masuk Anda.'}</p> : null}
      <button className="btn btn-primary" disabled={pending}>Kirim tautan</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetAction, null);
  if (state?.ok) return <div className="card mx-auto max-w-md p-6"><h1 className="text-3xl">Kata sandi diperbarui</h1><Link className="btn btn-primary mt-4" href="/login">Masuk</Link></div>;
  return (
    <form action={action} className="card mx-auto grid w-full max-w-md gap-3 p-6">
      <h1 className="text-3xl">Kata sandi baru</h1>
      <input type="hidden" name="token" value={token} />
      <label className="field">Kata sandi<input className="input" name="password" type="password" required minLength={8} /></label>
      <label className="field">Konfirmasi<input className="input" name="confirm" type="password" required /></label>
      {state?.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>Simpan</button>
    </form>
  );
}

export function SupportForm() {
  const [state, action, pending] = useActionState(supportAction, null);
  if (state?.ok) return <p className="font-semibold text-leaf">Pesan terkirim. Tim Andallo akan meninjaunya.</p>;
  return (
    <form action={action} className="grid gap-3">
      <label className="field">Nama<input className="input" name="name" required /></label>
      <label className="field">Email<input className="input" name="email" type="email" required /></label>
      <label className="field">Pesan<textarea className="input min-h-28" name="message" required /></label>
      {state?.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>Kirim</button>
    </form>
  );
}

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState(profileAction, null);
  return (
    <form action={action} className="card grid gap-3 p-5">
      <h2 className="text-2xl">Profil</h2>
      <label className="field">Nama<input className="input" name="name" defaultValue={name} required /></label>
      <label className="field">Telepon<input className="input" name="phone" defaultValue={phone} required /></label>
      {state && 'error' in state && state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state && 'ok' in state && state.ok ? <p className="text-sm text-leaf">Profil disimpan.</p> : null}
      <button className="btn btn-primary" disabled={pending}>Simpan</button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(passwordAction, null);
  return (
    <form action={action} className="card grid gap-3 p-5">
      <h2 className="text-2xl">Keamanan</h2>
      <label className="field">Kata sandi saat ini<input className="input" name="current" type="password" required /></label>
      <label className="field">Kata sandi baru<input className="input" name="password" type="password" required minLength={8} /></label>
      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-leaf">Kata sandi diperbarui.</p> : null}
      <button className="btn" disabled={pending}>Perbarui kata sandi</button>
    </form>
  );
}

export function PhoneForm({ verified }: { verified: boolean }) {
  const [code, setCode] = useState('');
  const [state, action, pending] = useActionState(confirmPhoneAction, null);
  return (
    <div className="card grid gap-3 p-5">
      <h2 className="text-2xl">Verifikasi telepon</h2>
      <p className="text-sm">{verified ? 'Nomor sudah terverifikasi.' : 'Nomor belum terverifikasi.'}</p>
      <button className="btn" type="button" onClick={async () => setCode((await phoneOtpAction()).code)}>Kirim OTP</button>
      {code ? <p className="text-sm">Kode pengembangan: <strong>{code}</strong></p> : null}
      <form action={action} className="grid gap-2">
        <input className="input" name="code" placeholder="6 digit" />
        {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        {state?.ok ? <p className="text-sm text-leaf">Telepon terverifikasi.</p> : null}
        <button className="btn btn-pine" disabled={pending}>Konfirmasi</button>
      </form>
    </div>
  );
}

export function ProviderRegisterForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(providerRegisterAction, null);
  const [point, setPoint] = useState({ lat: -6.2383, lng: 106.9756 });
  if (state && 'verifyPath' in state && (state.verifyPath || state.error === '')) {
    return <div className="card p-6"><h1 className="text-3xl">Pengajuan terkirim</h1><p className="mt-2">Status awal: diajukan. Usaha tampil ke pelanggan setelah admin memverifikasi.</p>{state.verifyPath ? <Link className="btn mt-4" href={state.verifyPath}>Verifikasi email</Link> : null}</div>;
  }
  return (
    <form action={action} className="grid gap-3">
      <label className="field">Nama pemilik<input className="input" name="name" required /></label>
      <label className="field">Nama usaha<input className="input" name="businessName" required /></label>
      <label className="field">Email<input className="input" name="email" type="email" required /></label>
      <label className="field">Telepon<input className="input" name="phone" required /></label>
      <label className="field">Kata sandi<input className="input" name="password" type="password" required minLength={8} /></label>
      <label className="field">Konfirmasi<input className="input" name="confirm" type="password" required /></label>
      <label className="field">Deskripsi<textarea className="input min-h-28" name="description" required minLength={20} /></label>
      <label className="field">Kategori<select className="select" name="categoryId" required>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field">Alamat<input className="input" name="address" required /></label>
      <label className="field">Kota<input className="input" name="city" defaultValue="Bekasi" required /></label>
      <label className="field">Radius layanan (km)<input className="input" name="radius" type="number" min={1} max={100} defaultValue={10} /></label>
      <input type="hidden" name="lat" value={point.lat} />
      <input type="hidden" name="lng" value={point.lng} />
      <p className="text-sm text-muted">Ketuk peta untuk menandai lokasi usaha.</p>
      <LeafletMap center={point} markers={[{ lat: point.lat, lng: point.lng, label: 'Lokasi usaha' }]} onPick={(lat, lng) => setPoint({ lat, lng })} />
      <label className="field">URL foto profil<input className="input" name="imageUrl" placeholder="https://" /></label>
      <label className="field">URL dokumen usaha (opsional)<input className="input" name="documentUrl" placeholder="https://" /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="terms" required /> Saya setuju data usaha ditinjau admin Andallo.</label>
      {state?.error ? <p className="text-sm font-semibold text-red-700">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Mengirim...' : 'Kirim pengajuan'}</button>
    </form>
  );
}

export function BookForm({ serviceId, providerId, packages, method, initialDate, initialSlots }: { serviceId: string; providerId: string; packages: { id: string; name: string; price: number }[]; method: string; initialDate: string; initialSlots: { slot: string; available: boolean; full: boolean }[] }) {
  const [state, action, pending] = useActionState(bookAction, null);
  const [slots, setSlots] = useState(initialSlots);
  async function load(nextDate: string) {
    const response = await fetch(`/api/slots?provider=${providerId}&date=${nextDate}`);
    const data = await response.json();
    setSlots(data.slots || []);
  }
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="method" value={method === 'BOTH' ? 'HOME_SERVICE' : method} />
      <label className="field">Paket<select className="select" name="packageId">{packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} · Rp{pkg.price.toLocaleString('id-ID')}</option>)}</select></label>
      <label className="field">Tanggal<input className="input" type="date" name="date" required defaultValue={initialDate} onChange={(event) => load(event.target.value)} /></label>
      <button className="btn" type="button" onClick={(event) => { const form = event.currentTarget.form; if (!form) return; const value = String(new FormData(form).get('date') || ''); if (value) load(value); }}>Cek ketersediaan</button>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <label key={slot.slot} className={`btn ${slot.available ? '' : 'opacity-50'}`}>
            <input type="radio" name="time" value={slot.slot} disabled={!slot.available} required={slot.available} />
            {slot.full ? 'Jadwal penuh' : slot.slot}
          </label>
        ))}
      </div>
      <label className="field">Alamat layanan<textarea className="input min-h-24" name="address" required minLength={5} /></label>
      <label className="field">Catatan<textarea className="input" name="notes" /></label>
      {state?.error ? <p className="text-sm font-semibold text-red-700" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Mengirim...' : 'Kirim pesanan'}</button>
    </form>
  );
}
