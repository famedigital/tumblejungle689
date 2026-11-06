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
  AlertCircle,
  Utensils,
  QrCode,
  User,
  Phone,
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
    <div className="max-w-lg md:max-w-none mx-auto p-3 md:p-4 space-y-3">
      <div className="sticky top-0 z-10 -mx-3 md:-mx-4 px-3 md:px-4 pt-0.5 pb-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by code, name, phone, table..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Playing</span>
          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">≤10m</span>
          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Over</span>
          <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Walk-in</span>
          <span className="ml-auto normal-case tracking-normal font-semibold text-slate-500">
            {filteredVisits.length} shown
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {filteredVisits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-slate-50/80 dark:bg-slate-950/50">
            <CheckCircle2 className="h-10 w-10 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No active guests found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tap &quot;Admit&quot; to issue a wristband pass.
            </p>
          </div>
        ) : (
          filteredVisits.map((visit) => {
            const paidUntilMs = new Date(visit.paidUntil).getTime();
            const diffMin = Math.round((paidUntilMs - now) / 60000);
            const isOvertime = isPlayVisit(visit) && diffMin < 0;
            const isEndingSoon = isPlayVisit(visit) && diffMin >= 0 && diffMin <= 10;
            const overtimeNu = isOvertime ? Math.abs(diffMin) * (extraPerMinNu || 10) : 0;
            const leaveOk = canLeaveOnTime(visit, now);
            const dropOk = canFloorDrop(visit, now);
            const playOk = isPlayVisit(visit);
            const tone = isOvertime
              ? "over"
              : isEndingSoon
                ? "ending"
                : playOk
                  ? "play"
                  : "walkin";
            const cardTone =
              tone === "over"
                ? "border-rose-300 dark:border-rose-800 bg-gradient-to-br from-rose-50 via-white to-white dark:from-rose-950/50 dark:via-slate-900 dark:to-slate-900 shadow-[inset_4px_0_0_0_rgb(244,63,94)]"
                : tone === "ending"
                  ? "border-amber-300 dark:border-amber-800 bg-gradient-to-br from-amber-50 via-white to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 shadow-[inset_4px_0_0_0_rgb(245,158,11)]"
                  : tone === "play"
                    ? "border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/90 via-white to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 shadow-[inset_4px_0_0_0_rgb(16,185,129)]"
                    : "border-sky-200 dark:border-sky-900/60 bg-gradient-to-br from-sky-50/90 via-white to-white dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-900 shadow-[inset_4px_0_0_0_rgb(14,165,233)]";

            return (
              <div key={visit.id} className={`rounded-2xl border transition-all p-3.5 ${cardTone}`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base font-mono text-slate-900 dark:text-white">{visit.code}</span>
                      {visit.tableNo ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {visit.tableNo}
                        </span>
                      ) : null}
                      {visit.leftAt ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          Held
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                        <User className="h-3 w-3" /> {visit.guardianName || "Guest"}
                      </span>
                      {visit.phone && !visit.phone.startsWith("F") ? (
                        <span className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300">
                          <Phone className="h-3 w-3" /> {visit.phone}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {playOk ? (
                    <div
                      className={`flex flex-col items-end gap-0.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold shrink-0 ${
                        isOvertime
                          ? "bg-rose-600 text-white animate-pulse shadow-sm shadow-rose-600/30"
                          : isEndingSoon
                            ? "bg-amber-500 text-white shadow-sm shadow-amber-500/25"
                            : "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {isOvertime ? `${Math.abs(diffMin)}m OVER` : `${diffMin}m left`}
                      </span>
                      <span className="text-[9px] font-semibold opacity-90 normal-case tracking-normal">
                        {isOvertime ? "Charge or extend" : isEndingSoon ? "Ending soon" : "Play time"}
                      </span>
                    </div>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-sky-600 text-white">
                      Walk-in
                    </span>
                  )}
                </div>

                {isOvertime ? (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2 font-medium">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                        Overtime (+{Math.abs(diffMin)} min) — staff may have forgotten to extend
                      </span>
                      <span className="font-bold font-mono shrink-0">~Nu. {overtimeNu}</span>
                    </div>
                    {onExtend ? (
                      <button
                        type="button"
                        onClick={() => onExtend(visit)}
                        className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold"
                      >
                        Fix overtime · extend / charge / waive
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {visit.lines.length > 0 ? (
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Food Tab ({visit.lines.length} items):
                    </span>{" "}
                    {visit.lines.map((l) => `${l.qty}x ${l.name}`).join(", ")}
                  </div>
                ) : null}

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  {playOk && onExtend ? (
                    <button
                      type="button"
                      onClick={() => onExtend(visit)}
                      className={`flex-1 min-w-[6.5rem] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        isOvertime || isEndingSoon
                          ? "bg-amber-500 hover:bg-amber-400 text-white"
                          : "border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                      }`}
                    >
                      <Timer className="h-3.5 w-3.5" />
                      <span>Extend</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onSelectForOrder(visit)}
                    className="flex-1 min-w-[5.5rem] py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Utensils className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Food</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectForCheckout(visit)}
                    className="flex-1 min-w-[5.5rem] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-[0.98] transition-all"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>Settle</span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuId(menuId === visit.id ? null : visit.id)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      title="More actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuId === visit.id ? (
                      <div className="absolute right-0 bottom-full mb-1 z-20 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 text-xs">
                        {playOk ? (
                          <button
                            type="button"
                            disabled={busyId === visit.id}
                            onClick={() => void reprint(visit)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200"
                          >
                            <Printer className="h-3.5 w-3.5" /> Reprint pass
                          </button>
                        ) : null}
                        {playOk && !visit.leftAt ? (
                          <button
                            type="button"
                            disabled={busyId === visit.id}
                            onClick={() => void runAction(visit, "hold")}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200"
                          >
                            <Pause className="h-3.5 w-3.5" /> Hold / left floor
                          </button>
                        ) : null}
                        {leaveOk ? (
                          <button
                            type="button"
                            disabled={busyId === visit.id}
                            onClick={() => void runAction(visit, "leave")}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200"
                          >
                            <LogOut className="h-3.5 w-3.5" /> Leave on time
                          </button>
                        ) : null}
                        {dropOk ? (
                          <button
                            type="button"
                            disabled={busyId === visit.id}
                            onClick={() => void runAction(visit, "cancel")}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-800 dark:text-slate-200"
                          >
                            <LogOut className="h-3.5 w-3.5" /> Close tab
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
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
