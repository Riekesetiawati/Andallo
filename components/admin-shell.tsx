'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { logoutAction } from '@/app/actions';

const groups: [string, [string, string][]][] = [
  ['Utama', [['/admin', 'Dashboard']]],
  ['Pengguna', [['/admin/customers', 'Pelanggan'], ['/admin/providers', 'Mitra']]],
  ['Mitra', [['/admin/provider-verification', 'Verifikasi mitra'], ['/admin/services', 'Jasa mitra']]],
  ['Transaksi', [['/admin/bookings', 'Pesanan'], ['/admin/transactions', 'Monitoring'], ['/admin/cancellations', 'Pembatalan']]],
  ['Keuangan', [['/admin/banks', 'Verifikasi rekening']]],
  ['Dukungan', [['/admin/complaints', 'Komplain'], ['/admin/reviews', 'Ulasan']]],
  ['Konten', [['/admin/highlights', 'Highlight'], ['/admin/carousel', 'Carousel'], ['/admin/categories', 'Kategori']]],
  ['Sistem', [['/admin/notifications', 'Notifikasi'], ['/admin/audit-logs', 'Audit'], ['/admin/reports', 'Laporan'], ['/admin/settings', 'Pengaturan']]],
];

export function AdminShell({ name, children }: { name: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-sand md:grid md:grid-cols-[260px_1fr]">
      <aside className={`${open ? 'fixed inset-0 z-40 block' : 'hidden'} overflow-auto bg-pine p-4 text-white md:sticky md:top-0 md:block md:h-screen`}>
        <div className="mb-6 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 font-extrabold"><img src="/andallo-logo.png" alt="" className="h-8 w-8 rounded-full" /> Andallo WMS</Link>
          <button className="btn btn-ghost text-white md:hidden" type="button" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        {groups.map(([title, links]) => (
          <div key={title} className="mb-4">
            <p className="px-2 text-xs font-bold uppercase tracking-wide text-white/50">{title}</p>
            {links.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-xl px-2 py-2 text-sm hover:bg-white/10">{label}</Link>
            ))}
          </div>
        ))}
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
          <button className="btn md:hidden" type="button" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={18} /> Menu</button>
          <p className="hidden font-bold text-pine md:block">Andallo WMS</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm">{name}</span>
            <form action={logoutAction}><button className="btn" type="submit">Keluar</button></form>
          </div>
        </div>
        <div className="p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
