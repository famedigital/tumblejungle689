"use client";

import { useState, useEffect } from "react";
import { useV2Store } from "@/lib/v2/store";
import type { VisitView } from "@/lib/types";
import { Clock, Search, AlertCircle, Utensils, QrCode, User, Phone, CheckCircle2 } from "lucide-react";

export function FloorRadar({
  onSelectForOrder,
  onSelectForCheckout,
}: {
  onSelectForOrder: (visit: VisitView) => void;
  onSelectForCheckout: (visit: VisitView) => void;
}) {
  const visits = useV2Store((s) => s.visits);
  const extraPerMinNu = useV2Store((s) => s.extraPerMinNu);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Update countdown clock every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const filteredVisits = visits.filter((v) => {
    if (v.status !== "open") return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      v.code.toLowerCase().includes(q) ||
      (v.guardianName && v.guardianName.toLowerCase().includes(q)) ||
      (v.phone && v.phone.includes(q)) ||
      (v.tableNo && v.tableNo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by code, name, phone, table..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm text-slate-900 dark:text-white"
        />
      </div>

      {/* Active Visits Count Pill */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
        <span>Active on Floor: <strong>{filteredVisits.length}</strong></span>
        <span>Auto-syncing real-time</span>
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {filteredVisits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white/50 dark:bg-slate-900/50">
            <CheckCircle2 className="h-10 w-10 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              No active guests found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tap &quot;Admit&quot; below to issue a wristband pass.
            </p>
          </div>
        ) : (
          filteredVisits.map((visit) => {
            const paidUntilMs = new Date(visit.paidUntil).getTime();
            const diffMin = Math.round((paidUntilMs - now) / 60000);
            const isOvertime = diffMin < 0;
            const isEndingSoon = diffMin >= 0 && diffMin <= 10;

            const overtimeNu = isOvertime
              ? Math.abs(diffMin) * (extraPerMinNu || 10)
              : 0;

            return (
              <div
                key={visit.id}
                className={`rounded-2xl border transition-all p-4 shadow-sm bg-white dark:bg-slate-900 ${
                  isOvertime
                    ? "border-rose-300 dark:border-rose-900/60 ring-1 ring-rose-500/20"
                    : isEndingSoon
                    ? "border-amber-300 dark:border-amber-900/60 ring-1 ring-amber-500/20"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base font-mono text-slate-900 dark:text-white">
                        {visit.code}
                      </span>
                      {visit.tableNo && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {visit.tableNo}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                        <User className="h-3 w-3" /> {visit.guardianName || "Child"}
                      </span>
                      {visit.phone && visit.phone !== "00000000" && (
                        <span className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300">
                          <Phone className="h-3 w-3" /> {visit.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Countdown Badge */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold ${
                      isOvertime
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse"
                        : isEndingSoon
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {isOvertime
                        ? `${Math.abs(diffMin)}m OVER`
                        : `${diffMin}m left`}
                    </span>
                  </div>
                </div>

                {/* Overtime warning banner if applicable */}
                {isOvertime && (
                  <div className="mt-3 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between font-medium">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                      Play time expired (+{Math.abs(diffMin)} min)
                    </span>
                    <span className="font-bold font-mono">
                      Extra ~Nu. {overtimeNu}
                    </span>
                  </div>
                )}

                {/* Tab items summary */}
                {visit.lines.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Food Tab ({visit.lines.length} items):
                    </span>{" "}
                    {visit.lines.map((l) => `${l.qty}x ${l.name}`).join(", ")}
                  </div>
                )}

                {/* Action Buttons for Staff */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectForOrder(visit)}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Utensils className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Add Food / KOT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectForCheckout(visit)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-[0.98] transition-all"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>Pay QR / Settle</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
