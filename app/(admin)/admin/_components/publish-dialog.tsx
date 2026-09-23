"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, type SeriesOption } from "../analyze/_lib/types";

export interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Путь к .analysis.json относительно корня проекта. */
  jsonPath: string;
  title?: string;
  /** Список серий; если не передан, загружается при открытии. */
  series?: SeriesOption[];
  initialSeriesId?: string | null;
  onPublished?: (result: PublishResponse) => void;
}

export interface PublishResponse {
  bookId: string;
  updated: boolean;
  charactersCreated: number;
  charactersReused: number;
  publishedDate: string | null;
  dryRun: boolean;
  log: string[];
}

/** Публикация анализа в БД: серия, флаги «без картинок» и dry-run, итог. */
export function PublishDialog({
  open,
  onOpenChange,
  jsonPath,
  title,
  series: seriesProp,
  initialSeriesId = null,
  onPublished,
}: PublishDialogProps) {
  const [loadedSeries, setLoadedSeries] = useState<SeriesOption[] | null>(null);
  const [seriesId, setSeriesId] = useState<string | null>(initialSeriesId);
  const [skipImages, setSkipImages] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResponse | null>(null);

  const series = seriesProp ?? loadedSeries ?? [];
  const selected = series.find((s) => s.id === seriesId) ?? null;

  // Серии подгружаем сами, если родитель их не передал
  useEffect(() => {
    if (!open || seriesProp || loadedSeries) return;
    let cancelled = false;
    apiFetch<SeriesOption[]>("/api/admin/series")
      .then((list) => {
        if (!cancelled) setLoadedSeries(list);
      })
      .catch(() => {
        if (!cancelled) setLoadedSeries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, seriesProp, loadedSeries]);

  const publish = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await apiFetch<PublishResponse>("/api/admin/publish", {
        method: "POST",
        body: JSON.stringify({
          jsonPath,
          bookSeriesId: seriesId ?? undefined,
          skipImages,
          dryRun,
        }),
      });
      setResult(res);
      onPublished?.(res);
      toast.success(
        res.dryRun
          ? "Проверка прошла, в базу ничего не записано"
          : res.updated
            ? "Книга обновлена в базе"
            : "Книга сохранена в базе",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Публикация не удалась",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {title ? `Публикация: ${title}` : "Публикация в базу"}
          </DialogTitle>
          <DialogDescription>
            Книга с тем же названием и авторами будет обновлена, а не
            продублирована. Персонажи серии переиспользуются по имени и алиасам.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Серия</Label>
            <div className="flex gap-2">
              <Select
                value={selected}
                onValueChange={(item: SeriesOption | null) =>
                  setSeriesId(item?.id ?? null)
                }
                itemToStringLabel={(item: SeriesOption) => item.name}
                itemToStringValue={(item: SeriesOption) => item.id}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Без серии" />
                </SelectTrigger>
                <SelectContent>
                  {series.map((s) => (
                    <SelectItem key={s.id} value={s}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {seriesId && (
                <Button variant="ghost" onClick={() => setSeriesId(null)}>
                  Сбросить
                </Button>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skipImages}
              onChange={(e) => setSkipImages(e.target.checked)}
            />
            Без генерации обложки и картинок
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Проверка без записи (dry-run)
          </label>
          {result && (
            <div className="rounded-md bg-muted/50 p-3 text-xs">
              <div>
                {result.dryRun
                  ? "Dry-run"
                  : result.updated
                    ? "Обновлено"
                    : "Создано"}{" "}
                · персонажей создано {result.charactersCreated},
                переиспользовано {result.charactersReused}
                {result.publishedDate ? ` · год ${result.publishedDate}` : ""}
              </div>
              <div className="mt-1 text-muted-foreground break-all">
                id книги: {result.bookId}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          <Button onClick={publish} disabled={busy}>
            {busy ? "Публикация…" : dryRun ? "Проверить" : "Опубликовать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
