"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cliPreview,
  formatTokens,
  type BookEstimate,
  type ModelOption,
  type ModelsResponse,
  type WizardSettings,
} from "../_lib/types";

interface StepSettingsProps {
  estimate: BookEstimate | null;
  estimating: boolean;
  estimateError: string | null;
  models: ModelsResponse | null;
  settings: WizardSettings;
  onChange: (patch: Partial<WizardSettings>) => void;
  onStart: () => void;
  starting: boolean;
}

const LANGUAGE_LABEL: Record<BookEstimate["language"], string> = {
  russian: "русский",
  english: "английский",
  other: "не определён",
};

const CUSTOM = "__custom__";

export function StepSettings({
  estimate,
  estimating,
  estimateError,
  models,
  settings,
  onChange,
  onStart,
  starting,
}: StepSettingsProps) {
  const [customModel, setCustomModel] = useState("");

  // Варианты размера фрагмента: пресеты из оценки + «вся книга» + своё значение
  const chunkOptions = useMemo(() => {
    if (!estimate) return [];
    const entries = Object.entries(estimate.chunkCounts)
      .map(([tokens, count]) => ({ tokens: Number(tokens), count }))
      .sort((a, b) => a.tokens - b.tokens);
    return entries.map((e) => ({
      ...e,
      whole: e.tokens === estimate.wholeBookChunkTokens,
    }));
  }, [estimate]);

  const isPreset = chunkOptions.some((o) => o.tokens === settings.chunkTokens);
  const chunkSelectValue = isPreset ? String(settings.chunkTokens) : CUSTOM;

  const modelOptions = models?.models ?? [];
  const knownModel = modelOptions.find((m) => m.id === settings.model) ?? null;
  const modelSelectValue: ModelOption | typeof CUSTOM_MODEL | null =
    knownModel ?? (settings.model ? CUSTOM_MODEL : null);

  const canStart = Boolean(
    estimate && settings.model && settings.chunkTokens >= 5_000 && !estimating,
  );

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Оценка книги
        </h3>
        {estimating ? (
          <div className="grid gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : estimateError ? (
          <p className="text-sm text-destructive">{estimateError}</p>
        ) : estimate ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-4">
              <Stat
                label="Страниц"
                value={estimate.pages.toLocaleString("ru-RU")}
              />
              <Stat
                label="Символов"
                value={estimate.chars.toLocaleString("ru-RU")}
              />
              <Stat
                label="Токенов, оценка"
                value={`~${formatTokens(estimate.estimatedTokens)}`}
              />
              <Stat label="Язык" value={LANGUAGE_LABEL[estimate.language]} />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Оценка считает 3 символа на токен. Для английского текста реальных
              токенов примерно на четверть меньше.
            </p>
          </>
        ) : null}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Размер фрагмента</Label>
          <Select
            value={chunkSelectValue}
            onValueChange={(v: string | null) => {
              if (!v || v === CUSTOM) return;
              onChange({ chunkTokens: Number(v) });
            }}
            disabled={!estimate}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chunkOptions.map((o) => (
                <SelectItem key={o.tokens} value={String(o.tokens)}>
                  {o.whole
                    ? "Вся книга одним фрагментом"
                    : `${formatTokens(o.tokens)} токенов`}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {o.count}{" "}
                    {plural(o.count, "фрагмент", "фрагмента", "фрагментов")}
                  </span>
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>Своё значение…</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={5_000}
              max={1_000_000}
              step={5_000}
              value={settings.chunkTokens}
              onChange={(e) =>
                onChange({ chunkTokens: Number(e.target.value) || 0 })
              }
              className="w-40"
            />
            <span className="text-xs text-muted-foreground">
              токенов, от 5 000 до 1 000 000
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            100 000 проверено на романе: полнее извлечение, чем вся книга разом,
            и надёжная склейка персонажей.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Модель</Label>
          <Select
            value={modelSelectValue}
            onValueChange={(item: ModelOption | typeof CUSTOM_MODEL | null) => {
              if (!item) return;
              if (item.id === CUSTOM) {
                onChange({ model: customModel });
                return;
              }
              onChange({ model: item.id });
            }}
            itemToStringLabel={(item: ModelOption | typeof CUSTOM_MODEL) =>
              item.label
            }
            itemToStringValue={(item: ModelOption | typeof CUSTOM_MODEL) =>
              item.id
            }
            disabled={!models}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  models ? "Выберите модель" : "Проверка доступности…"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.map((m) => (
                <SelectItem key={m.id} value={m} disabled={!m.available}>
                  <span className="flex flex-col">
                    <span>
                      {m.label}
                      {m.isDefault && (
                        <Badge variant="secondary" className="ml-2">
                          по умолчанию
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.available ? (m.note ?? m.id) : m.unavailableReason}
                    </span>
                  </span>
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_MODEL}>Другая модель…</SelectItem>
            </SelectContent>
          </Select>
          {(modelSelectValue === CUSTOM_MODEL || !knownModel) && (
            <Input
              value={knownModel ? customModel : settings.model}
              onChange={(e) => {
                setCustomModel(e.target.value);
                onChange({ model: e.target.value.trim() });
              }}
              placeholder="Имя модели, например deepseek-v4.1-flash"
            />
          )}
          {models && (
            <p className="text-xs text-muted-foreground">
              Ollama: {models.availability.ollama.host}
              {models.availability.ollama.reachable
                ? " отвечает"
                : " не отвечает"}
              {models.availability.ollama.directCloud
                ? models.availability.ollama.hasApiKey
                  ? ", ключ задан"
                  : ", ключ не задан"
                : ""}
              . Claude:{" "}
              {models.availability.claude.hasApiKey
                ? "ключ задан"
                : "ключ не задан"}
              .
            </p>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={settings.fresh}
          onChange={(e) => onChange({ fresh: e.target.checked })}
        />
        <span>
          Игнорировать промежуточные результаты предыдущего запуска
          <span className="block text-xs text-muted-foreground">
            Без этого флага готовые фрагменты и описания берутся из каталога
            .work рядом с выходным файлом, а существующий JSON возвращается как
            есть.
          </span>
        </span>
      </label>

      <div className="rounded-md bg-muted/50 p-3 font-mono text-xs break-all">
        {cliPreview(settings)}
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={onStart} disabled={!canStart || starting}>
          {starting ? "Запуск…" : "Запустить анализ"}
        </Button>
      </div>
    </div>
  );
}

const CUSTOM_MODEL: ModelOption = {
  id: CUSTOM,
  label: "Другая модель…",
  provider: "ollama-cloud",
  available: true,
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
