import Link from 'next/link';

export function Dash({ title, links, children }: { title: string; links: [string, string][]; children: React.ReactNode }) {
  return (
    <div className="container grid min-w-0 gap-6 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="flex min-w-0 max-w-full gap-2 overflow-x-auto md:block">
        <p className="hidden px-3 pb-3 font-extrabold text-pine md:block">{title}</p>
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold hover:bg-white md:block">{label}</Link>
        ))}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const customerLinks: [string, string][] = [
  ['/customer/dashboard', 'Dashboard'],
  ['/customer/bookings', 'Pesanan saya'],
  ['/customer/favorites', 'Favorit'],
  ['/customer/chat', 'Chat'],
  ['/customer/notifications', 'Notifikasi'],
  ['/customer/complaints', 'Komplain'],
  ['/customer/profile', 'Profil'],
  ['/customer/keamanan', 'Keamanan'],
];

export const providerLinks: [string, string][] = [
  ['/mitra/dashboard', 'Dashboard'],
  ['/mitra/bookings', 'Pesanan'],
  ['/mitra/services', 'Jasa saya'],
  ['/mitra/prices', 'Harga & paket'],
  ['/mitra/schedule', 'Jadwal'],
  ['/mitra/portfolio', 'Portofolio'],
  ['/mitra/location', 'Lokasi'],
  ['/mitra/profile', 'Profil'],
  ['/mitra/bank', 'Rekening'],
  ['/mitra/chat', 'Chat'],
  ['/mitra/notifications', 'Notifikasi'],
  ['/mitra/complaints', 'Komplain'],
  ['/mitra/pengaturan', 'Pengaturan'],
];
