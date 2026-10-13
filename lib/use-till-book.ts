"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chargeRatesOf } from "@/lib/charges";
import { backupReady, chooseBackupFile, readBackupFile, writeBackup } from "@/lib/till-backup";
import { applyOps, visitKey, type TillOp } from "@/lib/till-op";
import { emptyBase, readBook, writeBook, type TillBase, type TillBook } from "@/lib/till-store";
import type { TillSnapshot } from "@/lib/till-store";
import { codeFromScan } from "@/lib/format";
import type { MenuItem, VisitView } from "@/lib/types";

type SyncBody = {
  applied?: { id: string; visit: VisitView }[];
  failedId?: string;
  error?: string;
  retry?: boolean;
  todayNu?: number;
  playNu?: number;
  foodNu?: number;
  kotNu?: number;
  botNu?: number;
};

export function useTillBook(query?: string) {
  const [base, setBase] = useState<TillBase>(emptyBase);
  const [outbox, setOutbox] = useState<TillOp[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedCode, setSelectedCode] = useState(() => codeFromScan(query ?? ""));
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
          kotNu: body.kotNu ?? bookRef.current.base.kotNu,
          botNu: body.botNu ?? bookRef.current.base.botNu,
          savedAt: new Date().toISOString(),
        };
        const nextOutbox = bookRef.current.outbox.filter((op) => !appliedIds.has(op.id));
        const removed = batch.filter((op) => appliedIds.has(op.id)).length;
        try {
          await remember({ base: nextBase, outbox: nextOutbox });
        } catch {
          stalled = true;
          setNote("On this till");
          break;
        }
        if (body.error) setError(body.error);
        if (body.retry || removed === 0) {
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
    async (term?: string): Promise<VisitView | null> => {
      const stamp = bookRef.current.base.savedAt;
      const hadOutbox = bookRef.current.outbox.length > 0;
      try {
        const response = await fetch(`/api/till/snapshot${term ? `?q=${encodeURIComponent(term)}` : ""}`);
        if (!response.ok) return null;
        const snapshot = (await response.json()) as TillSnapshot;
        const { focus: found, ...rest } = snapshot;
        const newer = (rest.generation ?? 0) > (bookRef.current.base.generation ?? 0);
        if (!newer && (hadOutbox || bookRef.current.base.savedAt !== stamp || bookRef.current.outbox.length)) return null;
        await remember({ base: rest, outbox: [] });
        if (found) {
          setFocus(found);
          if (term) setSelectedCode(found.code);
        }
        setNote("Saved");
        return found ?? null;
      } catch {
        if (bookRef.current.base.savedAt) setNote("On this till");
        return null;
      }
    },
    [remember],
  );

  const recall = useCallback(
    async (term: string): Promise<VisitView | null> => {
      const wanted = codeFromScan(term);
      const phone = term.replace(/\D/g, "");
      const visits = foldOps(
        bookRef.current.base.visits,
        bookRef.current.outbox,
        bookRef.current.base.menu,
        bookRef.current.base.rates,
        bookRef.current.base.extraPerMinNu ?? 0,
        chargeRatesOf(bookRef.current.base),
      );
      const local = visits.find(
        (visit) => visit.status === "open" && (visit.code === wanted || (phone.length === 8 && visit.phone === phone)),
      );
      if (local) {
        setError("");
        setSelectedCode(local.code);
        return local;
      }
      const found = await pull(wanted || term);
      if (!found) {
        setError("No visit for that ticket.");
        return null;
      }
      setError("");
      setSelectedCode(found.code);
      return found;
    },
    [pull],
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

  const visits = useMemo(
    () => foldOps(base.visits, outbox, base.menu, base.rates, base.extraPerMinNu ?? 0, chargeRatesOf(base)),
    [base, outbox],
  );
  const open = useMemo(() => visits.filter((visit) => visit.status === "open"), [visits]);
  const selected = open.find((visit) => visit.code === selectedCode) ?? (focus?.code === selectedCode ? focus : null);

  const commit = useCallback(
    (op: TillOp) => {
      const stamped =
        op.kind === "settle"
          ? { ...op, receiptNo: op.receiptNo || Math.max(1, bookRef.current.base.nextReceipt || 1) }
          : op;
      try {
        applyOps(
          bookRef.current.base.visits,
          [...bookRef.current.outbox, stamped],
          bookRef.current.base.menu,
          bookRef.current.base.rates,
          bookRef.current.base.extraPerMinNu ?? 0,
          chargeRatesOf(bookRef.current.base),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not do that.");
        return null;
      }
      setError("");
      const next = {
        base: {
          ...bookRef.current.base,
          nextReceipt:
            stamped.kind === "settle"
              ? Math.max(bookRef.current.base.nextReceipt || 1, (stamped.receiptNo ?? 0) + 1)
              : bookRef.current.base.nextReceipt,
        },
        outbox: [...bookRef.current.outbox, stamped],
      };
      const folded = applyOps(
        next.base.visits,
        next.outbox,
        next.base.menu,
        next.base.rates,
        next.base.extraPerMinNu ?? 0,
        chargeRatesOf(next.base),
      );
      const visit = folded.find((item) => visitKey(item) === stamped.visitKey) ?? null;
      void remember(next).then(() => flush());
      setNote("On this till");
      if (visit) setSelectedCode(visit.code);
      return visit;
    },
    [flush, remember],
  );

  const addMenu = useCallback(
    (item: MenuItem) => {
      const current = bookRef.current;
      if (current.base.menu.some((row) => row.id === item.id)) return;
      void remember({ ...current, base: { ...current.base, menu: [...current.base.menu, item] } });
    },
    [remember],
  );

  const report = useCallback((message: string) => setError(message), []);

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
    addMenu,
    report,
    openBill,
    recall,
    setSelectedCode,
    chooseBackup,
    restoreBackup,
  };
}

function foldOps(
  visits: VisitView[],
  ops: TillOp[],
  menu: TillBase["menu"],
  rates: TillBase["rates"],
  extraPerMinNu = 0,
  charges = chargeRatesOf(null),
): VisitView[] {
  let next = visits;
  for (const op of ops) {
    try {
      next = applyOps(next, [op], menu, rates, extraPerMinNu, charges);
    } catch {
      break;
    }
  }
  return next;
}

function upsertVisit(visits: VisitView[], visit: VisitView): VisitView[] {
  const key = visitKey(visit);
  const without = visits.filter((item) => visitKey(item) !== key && item.id !== visit.id);
  if (visit.status !== "open") return without;
  return [...without, visit];
}
