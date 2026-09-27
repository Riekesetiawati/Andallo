import { notFound } from 'next/navigation';
import { complaintMessageAction } from '@/app/actions';
import { STATUS_LABEL } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import { complaintDetail } from '@/lib/repo';

export default async function ComplaintThread({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor('customer');
  const data = await complaintDetail(actor, (await params).id);
  if (!data) notFound();
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-3xl">{data.complaint.title}</h1>
        <p className="text-sm text-muted">{data.complaint.code} · {STATUS_LABEL[data.complaint.status] || data.complaint.status}</p>
        <p className="mt-2">{data.complaint.description}</p>
        <p className="text-sm">Harapan: {data.complaint.expected_solution}</p>
      </div>
      <div className="grid gap-2">
        {data.messages.map((message) => (
          <article key={message.created_at} className="card p-3 text-sm"><p className="font-bold">{message.full_name} · {message.role}</p><p>{message.body}</p></article>
        ))}
      </div>
      <form action={complaintMessageAction} className="flex gap-2">
        <input type="hidden" name="id" value={data.complaint.id} />
        <input className="input" name="body" placeholder="Tulis balasan" required />
        <button className="btn btn-pine">Kirim</button>
      </form>
    </div>
  );
}
