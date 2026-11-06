"use client";

import { useEffect, useRef, useState } from "react";
import type { VisitView } from "@/lib/types";
import { useV2Store } from "@/lib/v2/store";
import { formatNu, formatPhone } from "@/lib/format";
import { Search, X, Receipt, QrCode } from "lucide-react";

type Hit = {
  id: number;
  code: string;
  phone: string;
  status: "open" | "settled";
  childCount: number;
  tableNo: string;
  dueNu: number;
  kotQty: number;
  botQty: number;
};

export function FindDialog({
  isOpen,
  onClose,
  onOpenVisit,
  onSettle,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenVisit: (visit: VisitView) => void;
  onSettle: (visit: VisitView) => void;
}) {
  const visits = useV2Store((s) => s.visits);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => {
      setQ("");
      setHits([]);
      setError("");
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const term = q.trim();
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        if (!term) {
          setHits([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        setError("");
        try {
          const res = await fetch(`/api/till/search?q=${encodeURIComponent(term)}`);
          const data = await res.json();
          if (cancelled) return;
          if (!res.ok) throw new Error(data.error || "Search failed");
          setHits(data.hits || []);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Search failed");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q, isOpen]);

  const pick = (hit: Hit) => {
    if (hit.status === "settled") {
      window.open(`/receipt/${encodeURIComponent(hit.code)}`, "_blank", "noopener,noreferrer");
      onClose();
      return;
    }
    const open = visits.find((v) => v.id === hit.id || v.code === hit.code);
    if (open) {
      if (open.dueNu > 0) onSettle(open);
      else onOpenVisit(open);
      onClose();
      return;
    }
    window.open(`/receipt/${encodeURIComponent(hit.code)}`, "_blank", "noopener,noreferrer");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[12vh] px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find ticket · phone · table · receipt #"
            className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden sm:inline text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
            Esc
          </kbd>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {error ? <p className="text-sm text-rose-600 px-2 py-3">{error}</p> : null}
          {loading ? <p className="text-xs text-slate-500 px-2 py-3">Searching…</p> : null}
          {!loading && q.trim() && hits.length === 0 && !error ? (
            <p className="text-sm text-slate-500 px-2 py-6 text-center">No matches.</p>
          ) : null}
          {!q.trim() ? (
            <p className="text-xs text-slate-500 px-2 py-6 text-center">
              Type a pass code, phone, table, or receipt number. Open tickets settle here; closed ones open the receipt.
            </p>
          ) : null}
          <ul className="space-y-1">
            {hits.map((hit) => (
              <li key={`${hit.status}-${hit.id}-${hit.code}`}>
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  className="w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    {hit.status === "open" ? <QrCode className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {hit.code}
                      {hit.tableNo ? ` · ${hit.tableNo}` : ""}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {formatPhone(hit.phone)} · {hit.childCount} kid{hit.childCount === 1 ? "" : "s"}
                      {hit.kotQty || hit.botQty ? ` · food ${hit.kotQty + hit.botQty}` : ""}
                      {hit.status === "settled" ? " · closed" : " · open"}
                    </p>
                  </div>
                  {hit.dueNu > 0 ? (
                    <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">{formatNu(hit.dueNu)}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
