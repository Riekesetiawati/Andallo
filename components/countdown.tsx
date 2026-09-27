'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));
  useEffect(() => {
    const timer = setInterval(() => {
      const next = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setLeft(next);
      if (next === 0) {
        clearInterval(timer);
        fetch('/api/cron/expire').finally(() => router.refresh());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, router]);
  const minutes = String(Math.floor(left / 60000)).padStart(2, '0');
  const seconds = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  return <p className="rounded-2xl bg-orange/10 px-4 py-3 font-bold text-orange-dark">{left === 0 ? 'Waktu habis' : `${minutes}:${seconds} tersisa`}</p>;
}
