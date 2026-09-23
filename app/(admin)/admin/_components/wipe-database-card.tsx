"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "../analyze/_lib/types";
import type { WipeContentResult } from "@/lib/db/wipe-content";

const CONFIRM_PHRASE = "ОЧИСТИТЬ";

export function WipeDatabaseCard() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);

  const canConfirm = phrase === CONFIRM_PHRASE && !busy;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPhrase("");
  };

  const wipe = async () => {
    setBusy(true);
    try {
      const { deleted } = await apiFetch<{ deleted: WipeContentResult }>(
        "/api/admin/wipe",
        { method: "POST" },
      );
      const total = Object.values(deleted).reduce((sum, n) => sum + n, 0);
      toast.success(`База очищена, удалено записей: ${total}`);
      setOpen(false);
      setPhrase("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось очистить базу",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Очистка базы</CardTitle>
          <CardDescription>
            Удаляет книги, персонажей, обложки, отзывы, посты, сессии и коды
            верификации. Пользователи и их аккаунты остаются.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Очистить базу
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
          else setOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Очистить базу?</DialogTitle>
            <DialogDescription>
              Это нельзя отменить. Удалятся все данные, кроме пользователей и
              аккаунтов. Активные сессии тоже сбросятся, и всех разлогинит.
              Введите {CONFIRM_PHRASE}, чтобы подтвердить.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            disabled={busy}
          />
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={wipe} disabled={!canConfirm}>
              {busy ? "Очищаю…" : "Очистить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
