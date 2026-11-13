"use client";

import { useEffect, useState } from "react";
import type { RecentTxn } from "@/lib/types";
import { formatNu, formatPhone, formatWhen } from "@/lib/format";
import { History, X, ExternalLink, RefreshCw } from "lucide-react";

const KIND: Record<string, string> = {
  playtime: "Play",
  extension: "Extra play",
  food: "Food",
  void: "Void",
  waive: "Waived",
  leave: "Left",
  comp: "Comp",
};

export function RecentDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [recent, setRecent] = useState<RecentTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const res = await fetch("/api/v2/recent");
          const data = await res.json();
          if (cancelled) return;
          if (!res.ok) throw new Error(data.error || "Failed to load");
          setRecent(data.recent || []);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, refreshKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Recent today</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
          Today&apos;s payments and voids. Tap to open the receipt.
        </p>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {error ? <p className="text-sm text-rose-600 p-3">{error}</p> : null}
          {!loading && recent.length === 0 && !error ? (
            <p className="text-sm text-slate-500 text-center py-12">No payments yet today.</p>
          ) : null}
          {recent.map((item) => (
            <a
              key={`${item.kind}-${item.id}-${item.createdAt}`}
              href={`/receipt/${encodeURIComponent(item.code)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 px-3 py-3 hover:border-emerald-500/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {formatPhone(item.phone)} · {item.code}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {formatWhen(item.createdAt)} · {KIND[item.kind] ?? item.kind}
                  {item.method === "bank_qr" ? " · Bank" : item.method === "cash" ? " · Cash" : ""}
                  {item.status === "open" ? " · Open" : ""}
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                {formatNu(item.amountNu)}
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </a>
          ))}
        </div>
      </aside>
    </div>
  );
}
