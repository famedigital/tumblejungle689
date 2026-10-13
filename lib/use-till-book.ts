"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { backupReady, chooseBackupFile, readBackupFile, writeBackup } from "@/lib/till-backup";
import { applyOps, visitKey, type TillOp } from "@/lib/till-op";
import { emptyBase, readBook, writeBook, type TillBase, type TillBook } from "@/lib/till-store";
import type { TillSnapshot } from "@/lib/till-store";
import type { VisitView } from "@/lib/types";

type SyncBody = {
  applied?: { id: string; visit: VisitView }[];
  failedId?: string;
  error?: string;
  retry?: boolean;
  todayNu?: number;
  playNu?: number;
  foodNu?: number;
};

export function useTillBook(query?: string) {
  const [base, setBase] = useState<TillBase>(emptyBase);
  const [outbox, setOutbox] = useState<TillOp[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedCode, setSelectedCode] = useState(query ?? "");
  const [focus, setFocus] = useState<VisitView | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [backupOn, setBackupOn] = useState(false);
  const bookRef = useRef<TillBook>({ base: emptyBase(), outbox: [] });
  const flushing = useRef(false);

  const remember = useCallback(async (next: TillBook) => {
    bookRef.current = next;
    setBase(next.base);
    setOutbox(next.outbox);
    await writeBook(next);
    await writeBackup(next).catch(() => undefined);
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let stalled = false;
    try {
      while (bookRef.current.outbox.length) {
        const batch = bookRef.current.outbox;
        let body: SyncBody;
        try {
          const response = await fetch("/api/till/sync", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ops: batch }),
          });
          body = (await response.json()) as SyncBody;
          if (!response.ok && !body.error) body = { error: "Could not save.", retry: true };
        } catch {
          stalled = true;
          setNote("On this till");
          break;
        }
        const appliedIds = new Set((body.applied ?? []).map((row) => row.id));
        if (body.failedId && !body.retry) appliedIds.add(body.failedId);
        let visits = bookRef.current.base.visits;
        for (const row of body.applied ?? []) {
          visits = upsertVisit(visits, row.visit);
          const op = batch.find((item) => item.id === row.id);
          if (op && "code" in op && op.code && op.code !== row.visit.code) {
            setSelectedCode((current) => (current === op.code ? row.visit.code : current));
            const url = new URL(window.location.href);
            if (url.searchParams.get("q") === op.code) {
              url.searchParams.set("q", row.visit.code);
              window.history.replaceState(null, "", `${url.pathname}${url.search}`);
            }
          }
        }
        const nextBase: TillBase = {
          ...bookRef.current.base,
          visits,
          todayNu: body.todayNu ?? bookRef.current.base.todayNu,
          playNu: body.playNu ?? bookRef.current.base.playNu,
          foodNu: body.foodNu ?? bookRef.current.base.foodNu,
          savedAt: new Date().toISOString(),
        };
        const nextOutbox = bookRef.current.outbox.filter((op) => !appliedIds.has(op.id));
        await remember({ base: nextBase, outbox: nextOutbox });
        if (body.error) setError(body.error);
        if (body.retry || (!body.applied?.length && body.error)) {
          stalled = true;
          break;
        }
      }
      setNote(bookRef.current.outbox.length ? "On this till" : "Saved");
    } finally {
      flushing.current = false;
      if (!stalled && bookRef.current.outbox.length) void flush();
    }
  }, [remember]);

  const pull = useCallback(
    async (term?: string) => {
      if (bookRef.current.outbox.length) return;
      const stamp = bookRef.current.base.savedAt;
      try {
        const response = await fetch(`/api/till/snapshot${term ? `?q=${encodeURIComponent(term)}` : ""}`);
        if (!response.ok || bookRef.current.outbox.length || bookRef.current.base.savedAt !== stamp) return;
        const snapshot = (await response.json()) as TillSnapshot;
        const { focus: found, ...rest } = snapshot;
        await remember({ base: rest, outbox: [] });
        if (found) {
          setFocus(found);
          if (term && found.code !== term.trim().toUpperCase()) setSelectedCode(found.code);
        }
        setNote("Saved");
      } catch {
        if (bookRef.current.base.savedAt) setNote("On this till");
      }
    },
    [remember],
  );

  useEffect(() => {
    let cancel = false;
    async function boot() {
      const stored = await readBook().catch(() => null);
      if (cancel) return;
      if (stored) await remember(stored);
      setBackupOn(await backupReady().catch(() => false));
      setReady(true);
      if (stored?.outbox.length) {
        setNote("On this till");
        void flush();
        return;
      }
      await pull(query);
    }
    void boot();
    return () => {
      cancel = true;
    };
  }, [flush, pull, query, remember]);

  useEffect(() => {
    function onOnline() {
      if (bookRef.current.outbox.length) void flush();
    }
    function onVisible() {
      if (document.visibilityState === "visible" && bookRef.current.outbox.length) void flush();
    }
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flush]);

  const visits = useMemo(() => applyOps(base.visits, outbox, base.menu, base.rates), [base, outbox]);
  const open = visits.filter((visit) => visit.status === "open");
  const selected = open.find((visit) => visit.code === selectedCode) ?? (focus?.code === selectedCode ? focus : null);

  const commit = useCallback(
    (op: TillOp) => {
      try {
        applyOps(bookRef.current.base.visits, [...bookRef.current.outbox, op], bookRef.current.base.menu, bookRef.current.base.rates);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not do that.");
        return null;
      }
      setError("");
      const next = { base: bookRef.current.base, outbox: [...bookRef.current.outbox, op] };
      const folded = applyOps(next.base.visits, next.outbox, next.base.menu, next.base.rates);
      const visit = folded.find((item) => visitKey(item) === op.visitKey) ?? null;
      void remember(next).then(() => flush());
      setNote("On this till");
      if (visit) setSelectedCode(visit.code);
      return visit;
    },
    [flush, remember],
  );

  const openBill = useCallback((code: string) => {
    setSelectedCode(code);
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("q", code);
    else url.searchParams.delete("q");
    url.searchParams.delete("error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

  const chooseBackup = useCallback(async () => {
    const ok = await chooseBackupFile().catch(() => false);
    if (!ok) return;
    setBackupOn(true);
    await writeBackup(bookRef.current).catch(() => undefined);
  }, []);

  const restoreBackup = useCallback(async () => {
    const book = await readBackupFile().catch(() => null);
    if (!book) return;
    await remember(book);
    setBackupOn(true);
    setNote(book.outbox.length ? "On this till" : "Saved");
    if (book.outbox.length) void flush();
  }, [flush, remember]);

  return {
    ready,
    base,
    open,
    visit: selected,
    pending: outbox.length,
    note,
    error,
    backupOn,
    commit,
    openBill,
    setSelectedCode,
    chooseBackup,
    restoreBackup,
  };
}

function upsertVisit(visits: VisitView[], visit: VisitView): VisitView[] {
  const key = visitKey(visit);
  const without = visits.filter((item) => visitKey(item) !== key && item.id !== visit.id);
  if (visit.status !== "open") return without;
  return [...without, visit];
}
