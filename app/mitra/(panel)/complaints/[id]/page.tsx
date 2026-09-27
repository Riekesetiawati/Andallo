import { notFound } from 'next/navigation';
import { complaintMessageAction } from '@/app/actions';
import { STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { complaintDetail } from '@/lib/repo';

export default async function MitraComplaint({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor('provider');
  const data = await complaintDetail(actor, (await params).id);
  if (!data) notFound();
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl">{data.complaint.title}</h1>
      <p className="text-sm">{STATUS_LABEL[data.complaint.status]} · {data.complaint.code}</p>
      <p>{data.complaint.description}</p>
      {data.messages.map((message) => <article key={message.created_at + message.body} className="card p-3 text-sm"><strong>{message.full_name}</strong><p>{message.body}</p></article>)}
      <form action={complaintMessageAction} className="flex gap-2">
        <input type="hidden" name="id" value={data.complaint.id} />
        <input className="input" name="body" required placeholder="Balasan" />
        <button className="btn btn-pine">Kirim</button>
      </form>
    </div>
  );
}
