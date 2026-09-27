import Link from 'next/link';
import { ChatPanel } from '@/components/chat-panel';
import { Empty } from '@/components/chrome';
import { requireActor } from '@/lib/guard';
import { listThreads, threadMessages } from '@/lib/repo';

export default async function MitraChat({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const actor = await requireActor('provider');
  const threads = await listThreads(actor);
  const selected = (await searchParams).thread || threads[0]?.id;
  const detail = selected ? await threadMessages(actor, selected) : null;
  if (!threads.length) return <Empty title="Belum ada percakapan" text="Percakapan muncul bersama pesanan." />;
  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <aside className="flex gap-2 overflow-auto md:grid">
        {threads.map((thread) => (
          <Link key={thread.id} href={`/mitra/chat?thread=${thread.id}`} className={`card p-3 text-sm ${thread.id === selected ? 'border-leaf' : ''}`}>
            <p className="font-bold">{thread.customer_name}</p>
            <p className="text-muted">{thread.code}</p>
          </Link>
        ))}
      </aside>
      {detail?.thread ? <ChatPanel threadId={selected} mine={actor.id} role="provider" initial={detail.messages} /> : null}
    </div>
  );
}
