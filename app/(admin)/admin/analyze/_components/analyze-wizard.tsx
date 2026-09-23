"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  apiFetch,
  DEFAULT_CHUNK_TOKENS,
  type BookEstimate,
  type JobView,
  type ModelsResponse,
  type PdfFile,
  type SeriesOption,
  type WizardSettings,
} from "../_lib/types";
import { StepRun } from "./step-run";
import { StepSettings } from "./step-settings";
import { StepSource } from "./step-source";

type Step = "source" | "settings" | "run";

const STEPS: Array<{ key: Step; title: string }> = [
  { key: "source", title: "Источник" },
  { key: "settings", title: "Параметры" },
  { key: "run", title: "Выполнение" },
];

export function AnalyzeWizard({
  initialJobId,
}: {
  initialJobId: string | null;
}) {
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [step, setStep] = useState<Step>(initialJobId ? "run" : "source");

  const [pdfs, setPdfs] = useState<PdfFile[]>([]);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);

  const [settings, setSettings] = useState<WizardSettings>({
    pdf: "",
    title: "",
    bookSeriesId: null,
    chunkTokens: DEFAULT_CHUNK_TOKENS,
    model: "",
    fresh: false,
  });

  const [estimate, setEstimate] = useState<BookEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadPdfs = useCallback(async () => {
    setPdfs(await apiFetch<PdfFile[]>("/api/admin/pdfs"));
  }, []);

  // Справочники: PDF, серии, модели
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pdfList, seriesList, modelList] = await Promise.all([
          apiFetch<PdfFile[]>("/api/admin/pdfs"),
          apiFetch<SeriesOption[]>("/api/admin/series"),
          apiFetch<ModelsResponse>("/api/admin/analyze/models"),
        ]);
        if (cancelled) return;
        setPdfs(pdfList);
        setSeries(seriesList);
        setModels(modelList);
        setSettings((prev) =>
          prev.model ? prev : { ...prev, model: modelList.defaultModel },
        );
      } catch (error) {
        if (!cancelled)
          toast.error(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить справочники",
          );
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Выбор PDF → оценка объёма → шаг 2. Запускается из обработчика выбора,
  // устаревшие ответы отбрасываются по счётчику запросов.
  const estimateRequest = useRef(0);
  const selectPdf = (pdf: string) => {
    setSettings((prev) => ({ ...prev, pdf }));
    if (!pdf) return;
    const requestId = ++estimateRequest.current;
    setEstimating(true);
    setEstimateError(null);
    setEstimate(null);
    setStep("settings");

    apiFetch<BookEstimate>("/api/admin/analyze/estimate", {
      method: "POST",
      body: JSON.stringify({ pdf }),
    })
      .then((result) => {
        if (requestId !== estimateRequest.current) return;
        setEstimate(result);
        setSettings((prev) => ({
          ...prev,
          // если книга короче одного фрагмента по умолчанию, предлагаем целиком
          chunkTokens:
            result.chunkCounts[String(DEFAULT_CHUNK_TOKENS)] === 1
              ? result.wholeBookChunkTokens
              : DEFAULT_CHUNK_TOKENS,
        }));
      })
      .catch((error) => {
        if (requestId !== estimateRequest.current) return;
        setEstimateError(
          error instanceof Error ? error.message : "Не удалось оценить книгу",
        );
      })
      .finally(() => {
        if (requestId === estimateRequest.current) setEstimating(false);
      });
  };

  const updateSettings = (patch: Partial<WizardSettings>) => {
    const { pdf, ...rest } = patch;
    if (pdf !== undefined && pdf !== settings.pdf) selectPdf(pdf);
    if (Object.keys(rest).length > 0)
      setSettings((prev) => ({ ...prev, ...rest }));
  };

  const setJobInUrl = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("job", id);
    else url.searchParams.delete("job");
    window.history.replaceState(null, "", url.toString());
  };

  const start = async (overrides: Partial<WizardSettings> = {}) => {
    const s = { ...settings, ...overrides };
    setStarting(true);
    try {
      const job = await apiFetch<JobView>("/api/admin/analyze/jobs", {
        method: "POST",
        body: JSON.stringify({
          pdf: s.pdf,
          model: s.model,
          chunkTokens: s.chunkTokens,
          title: s.title.trim() || undefined,
          bookSeriesId: s.bookSeriesId ?? undefined,
          fresh: s.fresh,
        }),
      });
      setJobId(job.id);
      setJobInUrl(job.id);
      setStep("run");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось запустить анализ",
      );
    } finally {
      setStarting(false);
    }
  };

  const newRun = () => {
    setJobId(null);
    setJobInUrl(null);
    setStep(settings.pdf ? "settings" : "source");
  };

  return (
    <div className="grid gap-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((s, i) => {
          const index = STEPS.findIndex((x) => x.key === step);
          const state = i < index ? "done" : i === index ? "active" : "pending";
          const clickable = state === "done" && step !== "run";
          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setStep(s.key)}
                className={cn(
                  "rounded-full border px-3 py-1",
                  state === "active" &&
                    "border-primary bg-primary text-primary-foreground",
                  state === "done" && "border-border bg-muted",
                  state === "pending" && "text-muted-foreground",
                  clickable && "cursor-pointer hover:bg-accent",
                )}
              >
                {i + 1}. {s.title}
              </button>
            </li>
          );
        })}
      </ol>

      {step !== "run" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {step === "source"
                ? "Шаг 1. Источник"
                : "Шаг 2. Параметры анализа"}
            </CardTitle>
            <CardDescription>
              {step === "source"
                ? "Выберите PDF, при желании укажите название и серию."
                : "Проверьте оценку объёма, выберите размер фрагмента и модель."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <StepSource
              pdfs={pdfs}
              series={series}
              loading={loadingLists}
              value={{
                pdf: settings.pdf,
                title: settings.title,
                bookSeriesId: settings.bookSeriesId,
              }}
              onChange={updateSettings}
              onPdfsChanged={loadPdfs}
              onSeriesCreated={(created) =>
                setSeries((prev) =>
                  prev.some((s) => s.id === created.id)
                    ? prev
                    : [...prev, created].sort(byName),
                )
              }
              compact={step === "settings"}
            />
            {step === "settings" && (
              <StepSettings
                estimate={estimate}
                estimating={estimating}
                estimateError={estimateError}
                models={models}
                settings={settings}
                onChange={updateSettings}
                onStart={() => start()}
                starting={starting}
              />
            )}
          </CardContent>
        </Card>
      )}

      {step === "run" && jobId && (
        <Card>
          <CardHeader>
            <CardTitle>Шаг 3. Выполнение</CardTitle>
            <CardDescription>
              Задача выполняется на сервере. Страницу можно перезагрузить или
              закрыть, лог восстановится по ссылке.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StepRun
              jobId={jobId}
              series={series}
              onRetry={(p) => start({ fresh: p.fresh })}
              onNewRun={newRun}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function byName(a: SeriesOption, b: SeriesOption): number {
  return a.name.localeCompare(b.name, "ru");
}
