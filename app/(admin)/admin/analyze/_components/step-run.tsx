"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PublishDialog } from "../../_components/publish-dialog";
import { useJobEvents } from "../_hooks/use-job-events";
import {
  apiFetch,
  formatDuration,
  formatTokens,
  type JobStatus,
  type SeriesOption,
} from "../_lib/types";
import { LogConsole } from "./log-console";

interface StepRunProps {
  jobId: string;
  series: SeriesOption[];
  onRetry: (params: { fresh: boolean }) => void;
  onNewRun: () => void;
}

type PhaseKey =
  "extract" | "pass1" | "aliases" | "classify" | "summaries" | "done";

const PHASES: Array<{ key: PhaseKey; label: string }> = [
  { key: "extract", label: "Текст" },
  { key: "pass1", label: "Проход 1" },
  { key: "aliases", label: "Алиасы" },
  { key: "classify", label: "Классификация" },
  { key: "summaries", label: "Описания" },
  { key: "done", label: "Готово" },
];

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "в очереди",
  running: "выполняется",
  done: "завершена",
  error: "ошибка",
  cancelled: "отменена",
};

export function StepRun({ jobId, series, onRetry, onNewRun }: StepRunProps) {
  const state = useJobEvents(jobId);
  const [cancelling, setCancelling] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const progress = useMemo(
    () => derivePhases(state.lines, state.status),
    [state.lines, state.status],
  );
  const isFinal =
    state.status === "done" ||
    state.status === "error" ||
    state.status === "cancelled";

  const cancel = async () => {
    setCancelling(true);
    try {
      await apiFetch(`/api/admin/analyze/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      toast.message("Отмена запрошена");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось отменить",
      );
    } finally {
      setCancelling(false);
    }
  };

  if (state.missing) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm">
        <p className="font-medium">Задача не найдена на сервере.</p>
        <p className="mt-1 text-muted-foreground">
          Скорее всего сервер перезапускался. Готовые результаты по-прежнему в
          списке JSON на главной странице админки, а промежуточные фрагменты в
          каталоге .work: повторный запуск с теми же параметрами продолжит с
          места остановки.
        </p>
        <Button className="mt-4" onClick={onNewRun}>
          Новый запуск
        </Button>
      </div>
    );
  }

  const params = state.job?.params;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {PHASES.map((phase) => {
          const s = progress.phases[phase.key];
          return (
            <Badge
              key={phase.key}
              variant={
                s === "active"
                  ? "default"
                  : s === "done"
                    ? "secondary"
                    : "outline"
              }
              className={cn(s === "pending" && "text-muted-foreground")}
            >
              {phase.label}
              {phase.key === "pass1" &&
                progress.pass1Total > 0 &&
                ` ${progress.pass1Done}/${progress.pass1Total}`}
            </Badge>
          );
        })}
        <span className="ml-auto text-sm text-muted-foreground">
          {state.status ? STATUS_LABEL[state.status] : "подключение…"}
          {!isFinal && state.status && !state.connected && " · переподключение"}
        </span>
      </div>

      {params && (
        <p className="text-xs text-muted-foreground break-all">
          {params.pdfPath.split("/").pop()} · {params.model} ·{" "}
          {formatTokens(params.chunkTokens ?? 0)} токенов на фрагмент
          {params.fresh ? " · без кэша" : ""}
        </p>
      )}

      <LogConsole lines={state.lines} gap={state.gap} />

      {state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.result && (
        <section className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">
            {state.result.title || "Без названия"}
            {state.result.authors && (
              <span className="text-muted-foreground">
                {" "}
                · {state.result.authors}
              </span>
            )}
            {state.result.reused && (
              <Badge variant="outline" className="ml-2">
                готовый результат
              </Badge>
            )}
          </h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            <Stat label="Главных" value={state.result.characters.main} />
            <Stat
              label="Второстепенных"
              value={state.result.characters.secondary}
            />
            <Stat label="Эпизодических" value={state.result.characters.minor} />
            <Stat label="Событий" value={state.result.events} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Время {formatDuration(state.result.elapsedMs)}
            {state.result.usage.map((u) => (
              <span key={u.model}>
                {" "}
                · {u.model}: {formatTokens(u.inputTokens)} вход /{" "}
                {formatTokens(u.outputTokens)} выход
                {u.estimatedCostUsd !== null &&
                  ` · ~$${u.estimatedCostUsd.toFixed(3)}`}
              </span>
            ))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground break-all">
            {state.result.outputPath}
          </p>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {!isFinal && (
          <Button
            variant="destructive"
            onClick={cancel}
            disabled={cancelling || !state.status}
          >
            {cancelling ? "Отмена…" : "Отменить"}
          </Button>
        )}
        {state.status === "error" && (
          <Button onClick={() => onRetry({ fresh: false })}>
            Повторить с кэшем
          </Button>
        )}
        {state.status === "cancelled" && (
          <Button onClick={() => onRetry({ fresh: false })}>Продолжить</Button>
        )}
        {state.result && (
          <>
            <Button
              variant="outline"
              onClick={() =>
                window.open(jsonUrl(state.result!.outputPath), "_blank")
              }
            >
              Открыть JSON
            </Button>
            <Button onClick={() => setPublishOpen(true)}>
              Опубликовать в БД
            </Button>
          </>
        )}
        {isFinal && (
          <Button variant="ghost" onClick={onNewRun}>
            Новый запуск
          </Button>
        )}
      </div>

      {state.result && (
        <PublishDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          jsonPath={relativeToProject(state.result.outputPath)}
          series={series}
          initialSeriesId={params?.bookSeriesId ?? null}
        />
      )}
    </div>
  );
}

// =============================================================================
// Вспомогательное
// =============================================================================

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

/** Абсолютный путь из результата → относительный от корня проекта для API. */
function relativeToProject(absolutePath: string): string {
  const marker = "lib/analyzer/generated/";
  const index = absolutePath.indexOf(marker);
  return index >= 0 ? absolutePath.slice(index) : absolutePath;
}

function jsonUrl(absolutePath: string): string {
  const b64 = btoa(unescape(encodeURIComponent(absolutePath)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `/api/admin/jsons/${b64}`;
}

type PhaseState = "pending" | "active" | "done";

function derivePhases(
  lines: Array<{ text: string; level: string }>,
  status: JobStatus | null,
): {
  phases: Record<PhaseKey, PhaseState>;
  pass1Done: number;
  pass1Total: number;
} {
  const order: PhaseKey[] = [
    "extract",
    "pass1",
    "aliases",
    "classify",
    "summaries",
    "done",
  ];
  let reached = -1;
  let pass1Done = 0;
  let pass1Total = 0;

  for (const line of lines) {
    const t = line.text;
    if (t.includes("Извлечение текста")) reached = Math.max(reached, 0);
    else if (t.startsWith("Проход 1")) {
      reached = Math.max(reached, 1);
      const m = t.match(/Проход 1: (\d+) фрагмент/);
      if (m) pass1Total = Number(m[1]);
    } else if (line.level === "success" && /^Фрагмент \d+\/\d+/.test(t.trim()))
      pass1Done += 1;
    else if (t.includes("взято из кэша") && t.includes("pass1")) {
      const m = t.match(/(\d+) из (\d+)/);
      if (m) pass1Done = Math.max(pass1Done, Number(m[1]));
    } else if (t.includes("объединение") || t.includes("алиас"))
      reached = Math.max(reached, 2);
    else if (t.startsWith("Проход 2:")) reached = Math.max(reached, 3);
    else if (t.startsWith("Проход 2.5")) reached = Math.max(reached, 4);
  }
  if (status === "done") reached = 5;

  const phases = {} as Record<PhaseKey, PhaseState>;
  order.forEach((key, i) => {
    phases[key] =
      i < reached
        ? "done"
        : i === reached
          ? status === "done"
            ? "done"
            : "active"
          : "pending";
  });
  return { phases, pass1Done, pass1Total };
}
