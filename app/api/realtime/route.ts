import { getActor } from '@/lib/session';
import { realtimeSnapshot } from '@/lib/repo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return new Response('Unauthorized', { status: 401 });
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const started = Date.now();
      const send = async () => {
        if (closed) return;
        const since = new Date(Date.now() - 4000).toISOString();
        const snapshot = await realtimeSnapshot(actor, since);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
      };
      const clock: { timer?: ReturnType<typeof setInterval> } = {};
      const stop = () => {
        if (closed) return;
        closed = true;
        if (clock.timer) clearInterval(clock.timer);
        try {
          controller.close();
        } catch {
          // The client already disconnected.
        }
      };
      await send().catch(stop);
      clock.timer = setInterval(() => {
        // Vercel ends a function that stays open indefinitely. Close cleanly so EventSource reconnects.
        if (Date.now() - started > 20_000) {
          stop();
          return;
        }
        send().catch(stop);
      }, 2500);
      request.signal.addEventListener('abort', stop);
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
