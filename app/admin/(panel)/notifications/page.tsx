import { adminList } from '@/lib/repo';

export default async function AdminNotes() {
  const rows = await adminList('notifications');
  return (
    <div>
      <h1 className="text-3xl">Notifikasi sistem</h1>
      <div className="mt-4 grid gap-2">{rows.map((row) => <article key={row.id} className="card p-3 text-sm"><p className="font-bold">{row.title} · {row.full_name}</p><p>{row.message}</p></article>)}</div>
    </div>
  );
}
