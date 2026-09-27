'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bell, Menu, MessageCircle, X } from 'lucide-react';
import { logoutAction } from '@/app/actions';

export type HeaderUser = { name: string; role: string } | null;

const links = [
  ['/', 'Beranda'],
  ['/jasa', 'Cari Jasa'],
  ['/jasa#kategori', 'Kategori'],
  ['/bandingkan', 'Bandingkan'],
  ['/customer/bookings', 'Pesanan'],
  ['/bantuan', 'Bantuan'],
];

export function Header({ user, unread }: { user: HeaderUser; unread: number }) {
  const [open, setOpen] = useState(false);
  const account = user?.role === 'admin' ? '/admin' : user?.role === 'provider' ? '/mitra/dashboard' : '/customer/dashboard';
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="container flex h-[72px] items-center gap-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-pine">
          <img src="/andallo-logo.png" alt="Andallo" className="h-9 w-9 rounded-full object-cover" />
          Andallo
        </Link>
        <nav className="desktop-nav ml-4 flex items-center gap-1 text-sm font-semibold">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full px-3 py-2 hover:bg-sand">{label}</Link>
          ))}
        </nav>
        <div className="desktop-nav ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href={user.role === 'provider' ? '/mitra/chat' : '/customer/chat'} aria-label="Chat" className="btn btn-ghost h-11 w-11 px-0"><MessageCircle size={18} /></Link>
              <Link href={user.role === 'admin' ? '/admin/notifications' : user.role === 'provider' ? '/mitra/notifications' : '/customer/notifications'} aria-label="Notifikasi" className="btn btn-ghost relative h-11 w-11 px-0">
                <Bell size={18} />
                {unread > 0 ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange px-1 text-[10px] text-white">{unread}</span> : null}
              </Link>
              <Link href={account} className="btn">{user.name.split(' ')[0]}</Link>
              <form action={logoutAction}><button className="btn btn-ghost" type="submit">Keluar</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn">Masuk</Link>
              <Link href="/register" className="btn btn-primary">Daftar</Link>
            </>
          )}
        </div>
        <button className="btn mobile-only ml-auto h-11 w-11 px-0" type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      {open ? (
        <nav className="mobile-menu container grid gap-1 pb-4">
          {links.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-semibold hover:bg-sand">{label}</Link>
          ))}
          {user ? (
            <>
              <Link href={user.role === 'provider' ? '/mitra/chat' : '/customer/chat'} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-semibold hover:bg-sand">Chat</Link>
              <Link href={user.role === 'admin' ? '/admin/notifications' : user.role === 'provider' ? '/mitra/notifications' : '/customer/notifications'} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-semibold hover:bg-sand">Notifikasi{unread ? ` (${unread})` : ''}</Link>
              <Link href={account} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-semibold hover:bg-sand">{user.name.split(' ')[0]}</Link>
              <form action={logoutAction}><button className="rounded-xl px-3 py-3 text-left font-semibold" type="submit">Keluar</button></form>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-semibold hover:bg-sand">Masuk</Link>
              <Link href="/register" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-semibold hover:bg-sand">Daftar</Link>
            </>
          )}
        </nav>
      ) : null}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-pine text-white">
      <div className="container grid gap-8 py-12 md:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold">Andallo</p>
          <p className="mt-2 text-sm text-white/75">Marketplace jasa lokal. Harga tertulis, ulasan dari pesanan selesai, dan mitra yang ditinjau admin.</p>
        </div>
        <div className="text-sm">
          <p className="font-bold">Jelajah</p>
          <div className="mt-2 grid gap-2 text-white/80">
            <Link href="/jasa">Cari jasa</Link>
            <Link href="/bandingkan">Bandingkan</Link>
            <Link href="/bantuan">Bantuan</Link>
          </div>
        </div>
        <div>
          <p className="font-bold">Punya keahlian?</p>
          <p className="mt-2 text-sm text-white/75">Daftarkan usaha Anda. Profil baru tampil setelah diverifikasi.</p>
          <Link href="/mitra/register" className="btn btn-primary mt-4">Daftar Menjadi Mitra Andallo</Link>
        </div>
      </div>
    </footer>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="card grid justify-items-center gap-2 px-6 py-12 text-center">
      <h2 className="text-2xl">{title}</h2>
      <p className="max-w-md text-muted">{text}</p>
      {action}
    </div>
  );
}

export function Notice({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mb-4 rounded-2xl bg-orange/10 px-4 py-3 text-sm font-semibold text-orange-dark" role="status">{text}</p>;
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  const value = Number(rating) || 0;
  return (
    <p className="text-sm font-semibold text-ink">
      <span className="text-orange">★ {value ? value.toFixed(1) : 'Baru'}</span>
      {count != null ? <span className="font-medium text-muted"> · {count} ulasan</span> : null}
    </p>
  );
}
