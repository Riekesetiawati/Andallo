import type { Metadata } from 'next';
import { Fraunces, Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });

export const metadata: Metadata = {
  title: 'Andallo',
  description: 'Temukan jasa, bandingkan harga, lihat rating dan ulasan, lalu pesan sesuai kebutuhanmu.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${outfit.variable} ${fraunces.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
