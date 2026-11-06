"use client";

import { useMemo, useState } from "react";
import type { VisitView } from "@/lib/types";
import { useV2Store } from "@/lib/v2/store";
import { formatNu, formatPhone } from "@/lib/format";
import { quoteOvertime } from "@/lib/overtime";
import { unpaidFood, unpaidPlay } from "@/lib/visit-rules";
import { AlertTriangle, Clock, Pause, QrCode, ShieldCheck, X } from "lucide-react";

export function ExtendPlayModal({
  visit,
  onClose,
  onDone,
  onSettle,
}: {
  visit: VisitView | null;
  onClose: () => void;
  onDone: (visit: VisitView) => void;
  onSettle?: (visit: VisitView) => void;
}) {
  const rates = useV2Store((s) => s.rates);
  const extraPerMinNu = useV2Store((s) => s.extraPerMinNu);
  const bootstrap = useV2Store((s) => s.bootstrap);
  const staff = useV2Store((s) => s.staff);
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  const overtime = useMemo(() => {
    if (!visit) return null;
    return quoteOvertime(visit.paidUntil, rates, now, extraPerMinNu || 0);
  }, [visit, rates, now, extraPerMinNu]);

  if (!visit) return null;

  const isOver = Boolean(overtime && overtime.extraMinutes > 0);
  const rate = rates.find((r) => r.minutes === minutes) || rates[0];
  const amount = (rate?.amountNu ?? 0) * Math.max(1, visit.childCount);
  const dueNow = (overtime?.amountNu ?? 0) + unpaidFood(visit) + unpaidPlay(visit);
  const billClear = unpaidFood(visit) === 0 && unpaidPlay(visit) === 0;
  const canWaive = isOver && billClear && staff?.role === "admin";
  const canHold = isOver && !visit.leftAt;

  const extend = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v2/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId: visit.id, minutes, phone: visit.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extend failed");
      await bootstrap();
      onDone(data.visit as VisitView);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extend failed");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: "hold" | "waive") => {
    if (action === "waive") {
      if (!canWaive) return;
      if (
        !window.confirm(
          `Waive ${overtime?.extraMinutes ?? 0} min OT (${formatNu(overtime?.amountNu ?? 0)}) and close? Use when staff forgot and the family already left with nothing else due.`,
        )
      ) {
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v2/visit-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId: visit.id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      await bootstrap();
      onDone(data.visit as VisitView);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const rateList = rates.length ? rates : [
    { minutes: 30, amountNu: 200 },
    { minutes: 60, amountNu: 350 },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-3 font-sans">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="extend-play-title"
        className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-3.5 space-y-2.5 max-h-[min(92dvh,36rem)] overflow-y-auto font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              id="extend-play-title"
              className="font-sans text-[15px] font-bold leading-tight text-slate-900 dark:text-white flex items-center gap-1.5"
            >
              {isOver ? (
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" aria-hidden />
              ) : (
                <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden />
              )}
              {isOver ? "Play time over" : "Extend play"}
            </h3>
            <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {visit.code} · {visit.guardianName || formatPhone(visit.phone)} · {visit.childCount} kid
              {visit.childCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isOver && overtime ? (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-2">
            <p className="font-sans text-xs font-bold text-rose-800 dark:text-rose-200">
              +{overtime.extraMinutes}m over · {formatNu(overtime.amountNu)} OT
            </p>
            <p className="font-sans text-[10px] leading-snug text-rose-700/90 dark:text-rose-300/90 mt-0.5">
              Staff forgot to extend, hold, or close? Fix it here — keep playing, charge OT, freeze the clock, or waive.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="font-sans text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {isOver ? "Still playing · add time from now" : "Add time"}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {rateList.map((r) => (
              <button
                key={r.minutes}
                type="button"
                onClick={() => setMinutes(r.minutes)}
                className={`rounded-lg border px-1.5 py-1.5 text-center transition-colors font-sans ${
                  minutes === r.minutes
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">{r.minutes}m</p>
                <p className="text-[9px] text-slate-500 mt-0.5 leading-none">{formatNu(r.amountNu)}</p>
              </button>
            ))}
          </div>
          <p className="font-sans text-[10px] leading-snug text-slate-600 dark:text-slate-400">
            {isOver
              ? `+${minutes}m from now · OT ${formatNu(overtime?.amountNu ?? 0)} stays until settle/waive · new ≈ `
              : "Unpaid until settle · ≈ "}
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatNu(amount)}</span>
          </p>
          <button
            type="button"
            disabled={busy || !rate}
            onClick={() => void extend()}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold font-sans disabled:opacity-50 active:scale-[0.985]"
          >
            {busy ? "Working…" : isOver ? `Forgot · keep playing +${minutes}m` : `Extend +${minutes} min`}
          </button>
        </div>

        {isOver ? (
          <div className="space-y-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <p className="font-sans text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Leaving / staff forgot to close
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {onSettle ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onSettle(visit);
                    onClose();
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-sans flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.985]"
                >
                  <QrCode className="h-3.5 w-3.5" aria-hidden />
                  Charge OT & settle · {formatNu(dueNow)}
                </button>
              ) : null}

              {canHold ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction("hold")}
                  className="w-full py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 text-[11px] font-bold font-sans flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Pause className="h-3.5 w-3.5" aria-hidden />
                  Hold · kids left floor (stop OT clock)
                </button>
              ) : visit.leftAt ? (
                <p className="font-sans text-[10px] text-center text-amber-700 dark:text-amber-300">
                  Held — OT frozen at leave time. Settle or waive to close.
                </p>
              ) : null}

              {canWaive ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction("waive")}
                  className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold font-sans flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                  Waive OT & close · admin · staff forgot
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? <p className="font-sans text-xs text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
