"use client";

import { useRef, useState } from "react";
import { LoaderIcon, UploadIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  apiFetch,
  formatBytes,
  type PdfFile,
  type SeriesOption,
} from "../_lib/types";

interface StepSourceProps {
  pdfs: PdfFile[];
  series: SeriesOption[];
  loading: boolean;
  value: { pdf: string; title: string; bookSeriesId: string | null };
  onChange: (patch: Partial<StepSourceProps["value"]>) => void;
  onPdfsChanged: () => Promise<void>;
  onSeriesCreated: (created: SeriesOption) => void;
  /** Шаг свёрнут (показывается над шагом 2). */
  compact?: boolean;
}

export function StepSource({
  pdfs,
  series,
  loading,
  value,
  onChange,
  onPdfsChanged,
  onSeriesCreated,
  compact,
}: StepSourceProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [seriesDialog, setSeriesDialog] = useState(false);
  const [seriesName, setSeriesName] = useState("");
  const [creatingSeries, setCreatingSeries] = useState(false);

  const selectedSeries =
    series.find((s) => s.id === value.bookSeriesId) ?? null;

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      await onPdfsChanged();
      onChange({ pdf: body.filename as string });
      toast.success(`Загружен ${body.filename}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось загрузить файл",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const createSeries = async () => {
    setCreatingSeries(true);
    try {
      const created = await apiFetch<SeriesOption & { created: boolean }>(
        "/api/admin/series",
        {
          method: "POST",
          body: JSON.stringify({ name: seriesName }),
        },
      );
      onSeriesCreated(created);
      onChange({ bookSeriesId: created.id });
      toast.success(
        created.created
          ? `Серия «${created.name}» создана`
          : `Серия «${created.name}» уже есть, выбрана`,
      );
      setSeriesDialog(false);
      setSeriesName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось создать серию",
      );
    } finally {
      setCreatingSeries(false);
    }
  };

  return (
    <div className={compact ? "grid gap-4 md:grid-cols-3" : "grid gap-5"}>
      <div className="space-y-1.5">
        <Label>PDF книги</Label>
        <div className="flex gap-2">
          <Select
            value={value.pdf || null}
            onValueChange={(pdf: string | null) => onChange({ pdf: pdf ?? "" })}
            disabled={loading || uploading}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  loading
                    ? "Загрузка списка…"
                    : "Выберите файл из lib/analyzer/books"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {pdfs.map((f) => (
                <SelectItem key={f.filename} value={f.filename}>
                  <span className="truncate">{f.filename}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatBytes(f.sizeBytes)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!compact && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <LoaderIcon className="animate-spin" />
                ) : (
                  <UploadIcon />
                )}
                Загрузить
              </Button>
            </>
          )}
        </div>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            После выбора файла мастер сам посчитает объём книги и перейдёт к
            настройкам.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="book-title">Название (необязательно)</Label>
        <Input
          id="book-title"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Если пусто, название извлечёт модель"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Серия (необязательно)</Label>
        <div className="flex gap-2">
          <Select
            value={selectedSeries}
            onValueChange={(item: SeriesOption | null) =>
              onChange({ bookSeriesId: item?.id ?? null })
            }
            itemToStringLabel={(item: SeriesOption) => item.name}
            itemToStringValue={(item: SeriesOption) => item.id}
            disabled={loading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Без серии" />
            </SelectTrigger>
            <SelectContent>
              {series.map((s) => (
                <SelectItem key={s.id} value={s}>
                  {s.name}
                  {typeof s.booksCount === "number" && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {s.booksCount} кн.
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {value.bookSeriesId && (
            <Button
              variant="ghost"
              onClick={() => onChange({ bookSeriesId: null })}
            >
              Сбросить
            </Button>
          )}
          <Button variant="outline" onClick={() => setSeriesDialog(true)}>
            Создать
          </Button>
        </div>
      </div>

      <Dialog open={seriesDialog} onOpenChange={setSeriesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая серия</DialogTitle>
            <DialogDescription>
              Одноимённая серия не дублируется, будет выбрана существующая.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
            placeholder="Например, Ведьмак"
            onKeyDown={(e) => {
              if (e.key === "Enter" && seriesName.trim()) void createSeries();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSeriesDialog(false)}>
              Отмена
            </Button>
            <Button
              onClick={createSeries}
              disabled={!seriesName.trim() || creatingSeries}
            >
              {creatingSeries ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
