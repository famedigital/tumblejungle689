"use client";

import { useEffect, useRef, useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import type { VisitView } from "@/lib/types";
import { canFloorDrop, canLeaveOnTime, isPlayVisit } from "@/lib/visit-rules";
import { playTimeUpWarning } from "@/lib/audio/sounds";
import { PlayPass } from "@/components/play-pass";
import { PrintPortal } from "@/components/print-portal";
import { thermalPrint } from "@/lib/print-station";
import { forceLocalPrintDialog } from "@/lib/v2/print-local";
import {
  Clock,
  Search,
  Utensils,
  QrCode,
  CheckCircle2,
  Timer,
  Pause,
  LogOut,
  Printer,
  MoreHorizontal,
} from "lucide-react";

export function FloorRadar({
  onSelectForOrder,
  onSelectForCheckout,
  onExtend,
}: {
  onSelectForOrder: (visit: VisitView) => void;
  onSelectForCheckout: (visit: VisitView) => void;
  onExtend?: (visit: VisitView) => void;
}) {
  const visits = useV2Store((s) => s.visits);
  const extraPerMinNu = useV2Store((s) => s.extraPerMinNu);
  const venueName = useV2Store((s) => s.venueName);
  const bootstrap = useV2Store((s) => s.bootstrap);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [menuId, setMenuId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [passPrint, setPassPrint] = useState<{ visit: VisitView; qr: string } | null>(null);
  const warnedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    for (const visit of visits) {
      if (visit.status !== "open" || !isPlayVisit(visit)) continue;
      const left = Math.round((new Date(visit.paidUntil).getTime() - now) / 60000);
      if (left <= 10 && left >= -5 && !warnedRef.current.has(visit.code)) {
        warnedRef.current.add(visit.code);
        playTimeUpWarning();
      }
      if (left > 15) warnedRef.current.delete(visit.code);
    }
  }, [visits, now]);

  useEffect(() => {
    if (!passPrint) return;
    const timer = window.setTimeout(() => {
      void thermalPrint("sticker", { forceBrowser: forceLocalPrintDialog() })
        .catch((err) => console.warn("Pass reprint:", err))
        .finally(() => window.setTimeout(() => setPassPrint(null), 600));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [passPrint]);

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

  const runAction = async (visit: VisitView, action: string) => {
    setBusyId(visit.id);
    setMenuId(null);
    try {
      const res = await fetch("/api/v2/visit-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId: visit.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      await bootstrap();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const reprint = async (visit: VisitView) => {
    setMenuId(null);
    try {
      const url = `${window.location.origin}/t/${visit.code}`;
      const mod = await import("qrcode");
      const qr = await mod.toDataURL(url, {
        margin: 1,
        width: 360,
        errorCorrectionLevel: "M",
        color: { dark: "#1f4d3a", light: "#ffffff" },
      });
      setPassPrint({ visit, qr });
    } catch (err) {
      console.warn(err);
      setPassPrint({ visit, qr: "" });
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-3">
      <div className="sticky top-0 z-10 -mx-3 md:-mx-4 px-3 md:px-4 py-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Find pass, name, phone, table"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          {filteredVisits.length} open on floor
        </p>
      </div>

      <div className="space-y-2">
        {filteredVisits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Floor is clear</p>
            <p className="text-xs text-slate-500 mt-1">Admit a pass to start.</p>
          </div>
        ) : (
          filteredVisits.map((visit) => {
            const diffMin = Math.round((new Date(visit.paidUntil).getTime() - now) / 60000);
            const isOvertime = isPlayVisit(visit) && diffMin < 0;
            const isEndingSoon = isPlayVisit(visit) && diffMin >= 0 && diffMin <= 10;
            const overtimeNu = isOvertime ? Math.abs(diffMin) * (extraPerMinNu || 10) : 0;
            const leaveOk = canLeaveOnTime(visit, now);
            const dropOk = canFloorDrop(visit, now);
            const playOk = isPlayVisit(visit);

            const edge = isOvertime
              ? "border-l-rose-500"
              : isEndingSoon
                ? "border-l-amber-500"
                : playOk
                  ? "border-l-emerald-500"
                  : "border-l-slate-300 dark:border-l-slate-600";

            return (
              <article
                key={visit.id}
                className={`rounded-xl border border-slate-200 dark:border-slate-800 border-l-4 ${edge} bg-white dark:bg-slate-900 p-3 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:scale-[0.995] transition-all duration-150`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{visit.code}</span>
                      {visit.tableNo ? (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {visit.tableNo}
                        </span>
                      ) : null}
                      {visit.leftAt ? (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded">
                          Held
                        </span>
                      ) : null}
                      {!playOk ? (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          Walk-in
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                      {visit.guardianName || "Guest"}
                      {visit.phone && !visit.phone.startsWith("F") ? ` · ${visit.phone}` : ""}
                      {visit.childCount > 0 ? ` · ${visit.childCount} kid${visit.childCount === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>

                  {playOk ? (
                    <div
                      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-right font-mono text-xs font-bold ${
                        isOvertime
                          ? "bg-rose-600 text-white"
                          : isEndingSoon
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {isOvertime ? `${Math.abs(diffMin)}m over` : `${diffMin}m`}
                      </span>
                      {isOvertime ? (
                        <p className="text-[9px] font-semibold opacity-90">~Nu. {overtimeNu}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {isOvertime && onExtend ? (
                  <button
                    type="button"
                    onClick={() => onExtend(visit)}
                    className="mt-2.5 w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold active:scale-[0.985] transition"
                  >
                    Fix overtime
                  </button>
                ) : null}

                {visit.lines.length > 0 ? (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Food: {visit.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                  </p>
                ) : null}

                <div className="mt-2.5 flex items-center gap-1.5">
                  {playOk && onExtend && !isOvertime ? (
                    <button
                      type="button"
                      onClick={() => onExtend(visit)}
                      className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.985] inline-flex items-center justify-center gap-1"
                    >
                      <Timer className="h-3.5 w-3.5" /> Extend
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onSelectForOrder(visit)}
                    className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.985] inline-flex items-center justify-center gap-1"
                  >
                    <Utensils className="h-3.5 w-3.5" /> Food
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectForCheckout(visit)}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold active:scale-[0.985] inline-flex items-center justify-center gap-1 shadow-sm"
                  >
                    <QrCode className="h-3.5 w-3.5" /> Settle
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuId(menuId === visit.id ? null : visit.id)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                      aria-label="More"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuId === visit.id ? (
                      <div className="absolute right-0 bottom-full mb-1 z-20 w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 text-xs">
                        {playOk ? (
                          <button
                            type="button"
                            disabled={busyId === visit.id}
                            onClick={() => void reprint(visit)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                          >
                            <Printer className="h-3.5 w-3.5" /> Reprint
                          </button>
                        ) : null}
                        {playOk && !visit.leftAt ? (
                          <button
                            type="button"
                            disabled={busyId === visit.id}
                            onClick={() => void runAction(visit, "hold")}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                          >
                            <Pause className="h-3.5 w-3.5" /> Hold
                          </button>
                        ) : null}
                        {leaveOk ? (
                          <button
                            type="button"
                            disabled={busyId === visit.id}
                            onClick={() => void runAction(visit, "leave")}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                          >
                            <LogOut className="h-3.5 w-3.5" /> Leave on time
                          </button>
                        ) : null}
                        {dropOk ? (
                          <button
                            type="button"
                            disabled={busyId === visit.id}
                            onClick={() => void runAction(visit, "cancel")}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                          >
                            <LogOut className="h-3.5 w-3.5" /> Close tab
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {passPrint ? (
        <PrintPortal>
          <PlayPass
            venue={venueName || "Tumble Jungle"}
            code={passPrint.visit.code}
            receiptNo={passPrint.visit.receiptNo}
            phone={passPrint.visit.phone}
            qr={passPrint.qr}
            childCount={passPrint.visit.childCount}
            started={passPrint.visit.createdAt}
            ends={passPrint.visit.paidUntil}
          />
        </PrintPortal>
      ) : null}
    </div>
  );
}
