import { notFound } from 'next/navigation';
import { complaintMessageAction } from '@/app/actions';
import { requireActor } from '@/lib/guard';
import { complaintDetail } from '@/lib/repo';

export default async function AdminComplaint({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor('admin');
  const data = await complaintDetail(actor, (await params).id);
  if (!data) notFound();
  return (
    <div className="grid max-w-2xl gap-3">
      <h1 className="text-3xl">{data.complaint.title}</h1>
      <p>{data.complaint.description}</p>
      {data.messages.map((message) => <article key={message.created_at + message.body} className="card p-3 text-sm"><strong>{message.full_name} ({message.role})</strong><p>{message.body}</p></article>)}
      <form action={complaintMessageAction} className="flex gap-2">
        <input type="hidden" name="id" value={data.complaint.id} />
        <input className="input" name="body" required placeholder="Catatan admin" />
        <button className="btn btn-pine">Kirim</button>
      </form>
    </div>
  );
}
