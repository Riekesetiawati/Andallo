import { getActor } from '@/lib/session';
import { realtimeSnapshot } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return new Response('Unauthorized', { status: 401 });
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (closed) return;
        const since = new Date(Date.now() - 4000).toISOString();
        const snapshot = await realtimeSnapshot(actor, since);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
      };
      await send();
      const timer = setInterval(() => {
        send().catch(() => undefined);
      }, 2500);
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(timer);
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
