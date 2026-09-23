import { requireAdmin } from "@/lib/admin-auth";
import {
  getEvents,
  getJob,
  subscribe,
  type JobEvent,
} from "@/lib/analyzer/jobs";

const KEEPALIVE_MS = 20_000;
const FINAL_STATUSES = new Set(["done", "error", "cancelled"]);

/**
 * Server-Sent Events по задаче. Сначала повтор накопленных событий после
 * `Last-Event-ID` (или `?after=`), затем живые. Закрывается, когда задача
 * завершена, или когда клиент отключился.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (admin.response) return admin.response;

  const { id } = await params;
  if (!getJob(id)) {
    return Response.json({ error: "Задача не найдена" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const lastEventId =
    request.headers.get("last-event-id") ?? searchParams.get("after");
  const afterSeq = Number.parseInt(lastEventId ?? "0", 10) || 0;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const cleanup: Array<() => void> = [];

      const close = () => {
        if (closed) return;
        closed = true;
        for (const fn of cleanup) fn();
        try {
          controller.close();
        } catch {
          // уже закрыт
        }
      };

      const send = (event: JobEvent) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(
            `id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`,
          ),
        );
        if (event.type === "status" && FINAL_STATUSES.has(event.status)) {
          // даём последнему событию уйти и закрываем стрим
          setTimeout(close, 0);
        }
      };

      // Если запрошенный хвост уже вытеснен из буфера, предупреждаем клиента
      const replay = getEvents(id, afterSeq);
      if (replay?.truncated) {
        controller.enqueue(
          encoder.encode(
            `event: gap\ndata: ${JSON.stringify({ droppedBefore: replay.events[0]?.seq ?? null })}\n\n`,
          ),
        );
      }

      const unsubscribe = subscribe(id, afterSeq, send);
      if (!unsubscribe) {
        close();
        return;
      }
      cleanup.push(unsubscribe);

      // Задача уже завершена: повтор ушёл синхронно в subscribe, закрываемся
      const job = getJob(id);
      if (job && FINAL_STATUSES.has(job.status)) {
        setTimeout(close, 0);
        return;
      }

      const keepalive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
      }, KEEPALIVE_MS);
      cleanup.push(() => clearInterval(keepalive));

      request.signal.addEventListener("abort", close, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
