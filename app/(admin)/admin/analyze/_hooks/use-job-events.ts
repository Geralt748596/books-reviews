"use client";

import { useEffect, useRef, useState } from "react";
import type { LogLine } from "@/lib/analyzer/run-context";
import {
  apiFetch,
  type JobEvent,
  type JobResultSummary,
  type JobStatus,
  type JobView,
} from "../_lib/types";

export interface JobEventsState {
  /** Для какой задачи собрано состояние; при смене id состояние сбрасывается на рендере. */
  jobId: string | null;
  job: JobView | null;
  status: JobStatus | null;
  lines: Array<LogLine & { seq: number }>;
  result: JobResultSummary | null;
  error: string | null;
  /** Часть ранних строк вытеснена из буфера сервера. */
  gap: boolean;
  /** Задача не найдена на сервере (например, после его перезапуска). */
  missing: boolean;
  connected: boolean;
}

const FINAL: ReadonlySet<JobStatus> = new Set(["done", "error", "cancelled"]);

/**
 * Подписка на события задачи через SSE. Браузер сам переподключается и шлёт
 * Last-Event-ID, сервер повторяет только недостающее.
 */
export function useJobEvents(jobId: string | null): JobEventsState {
  const [state, setState] = useState<JobEventsState>(() => initial(jobId));
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    // Сброс состояния под новую задачу делаем асинхронно вместе с загрузкой,
    // чтобы не вызывать setState синхронно внутри эффекта
    const reset = initial(jobId);

    apiFetch<JobView & { events: JobEvent[] }>(
      `/api/admin/analyze/jobs/${jobId}?after=0`,
    )
      .then((job) => {
        if (cancelled) return;
        setState({
          ...reset,
          job,
          status: job.status,
          result: job.result ?? null,
          error: job.error ?? null,
          gap: job.droppedEvents > 0,
        });
        // Все накопленные события пришли одним запросом; SSE догоняет с последнего
        applyEvents(job.events);
        if (FINAL.has(job.status)) return;
        openStream(job.lastSeq);
      })
      .catch(() => {
        if (!cancelled) setState({ ...reset, missing: true });
      });

    function applyEvents(events: JobEvent[]) {
      if (events.length === 0) return;
      setState((prev) => {
        const next = { ...prev, lines: [...prev.lines] };
        const seen = new Set(prev.lines.map((l) => l.seq));
        for (const event of events) {
          switch (event.type) {
            case "log":
              if (!seen.has(event.seq))
                next.lines.push({ ...event.line, seq: event.seq });
              break;
            case "status":
              next.status = event.status;
              break;
            case "done":
              next.result = event.result;
              break;
            case "error":
              next.error = event.message;
              break;
          }
        }
        return next;
      });
    }

    function openStream(afterSeq: number) {
      const source = new EventSource(
        `/api/admin/analyze/jobs/${jobId}/events?after=${afterSeq}`,
      );
      sourceRef.current = source;

      source.onopen = () => setState((prev) => ({ ...prev, connected: true }));
      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as JobEvent;
          applyEvents([event]);
          if (event.type === "status" && FINAL.has(event.status)) {
            source.close();
            setState((prev) => ({ ...prev, connected: false }));
          }
        } catch {
          // мусор в стриме игнорируем
        }
      };
      source.addEventListener("gap", () =>
        setState((prev) => ({ ...prev, gap: true })),
      );
      source.onerror = () => {
        // EventSource переподключится сам; если задача уже завершена, закрываем
        setState((prev) => {
          if (prev.status && FINAL.has(prev.status)) source.close();
          return { ...prev, connected: false };
        });
      };
    }

    return () => {
      cancelled = true;
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [jobId]);

  // Пока эффект не загрузил новую задачу, отдаём чистое состояние для её id
  return state.jobId === jobId ? state : initial(jobId);
}

function initial(jobId: string | null): JobEventsState {
  return {
    jobId,
    job: null,
    status: null,
    lines: [],
    result: null,
    error: null,
    gap: false,
    missing: false,
    connected: false,
  };
}
