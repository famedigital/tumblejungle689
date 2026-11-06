"use client";

import { useMemo, useState } from "react";
import type { VisitView } from "@/lib/types";
import { useV2Store } from "@/lib/v2/store";
import { formatNu, formatPhone } from "@/lib/format";
import { quoteOvertime, overtimeSentence } from "@/lib/overtime";
import { unpaidFood, unpaidPlay } from "@/lib/visit-rules";
import { AlertTriangle, Clock, QrCode, ShieldCheck, X } from "lucide-react";

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
  const billClear = unpaidFood(visit) === 0 && unpaidPlay(visit) === 0;
  const canWaive = isOver && billClear && staff?.role === "admin";

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

  const waive = async () => {
    if (!canWaive) return;
    if (
      !window.confirm(
        `Waive ${overtime?.extraMinutes ?? 0} min overtime (${formatNu(overtime?.amountNu ?? 0)}) and close this visit? Use when staff forgot and the family is leaving with nothing else due.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v2/visit-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId: visit.id, action: "waive" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Waive failed");
      await bootstrap();
      onDone(data.visit as VisitView);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Waive failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 space-y-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {isOver ? (
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              ) : (
                <Clock className="h-4 w-4 text-emerald-600" />
              )}
              {isOver ? "Play time over" : "Extend play"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {visit.code} · {visit.guardianName || formatPhone(visit.phone)} · {visit.childCount} kid
              {visit.childCount === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isOver && overtime ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 dark:bg-rose-950/30 p-3 space-y-2">
            <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
              {overtime.extraMinutes} min past paid time · {formatNu(overtime.amountNu)} overtime
            </p>
            <p className="text-[11px] text-rose-700/90 dark:text-rose-300/90">{overtimeSentence(overtime)}</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Staff forgot to top up? Pick one: keep them playing, settle the overtime, or (manager) waive OT if they&apos;re leaving.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isOver ? "1 · Extend from now (keep playing)" : "Add time"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(rates.length ? rates : [{ minutes: 30, amountNu: 200 }, { minutes: 60, amountNu: 350 }]).map((r) => (
              <button
                key={r.minutes}
                type="button"
                onClick={() => setMinutes(r.minutes)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  minutes === r.minutes
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <p className="text-sm font-bold text-slate-900 dark:text-white">{r.minutes} min</p>
                <p className="text-[11px] text-slate-500">{formatNu(r.amountNu)} / child</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {isOver
              ? `Clock restarts from now (+${minutes} min). Past overtime ${formatNu(overtime?.amountNu ?? 0)} stays on the bill until Settle or Waive.`
              : "Extra play is unpaid until Settle."}{" "}
            New block ≈{" "}
            <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400">{formatNu(amount)}</span>
          </p>
          <button
            type="button"
            disabled={busy || !rate}
            onClick={() => void extend()}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold disabled:opacity-50"
          >
            {busy ? "Working…" : isOver ? `Forgot · extend +${minutes} min now` : `Extend +${minutes} min`}
          </button>
        </div>

        {isOver ? (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              2 · Or finish this visit
            </p>
            {onSettle ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onSettle(visit);
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <QrCode className="h-4 w-4" />
                Charge OT & settle ({formatNu((overtime?.amountNu ?? 0) + unpaidFood(visit) + unpaidPlay(visit))})
              </button>
            ) : null}

            {canWaive ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void waive()}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-violet-600" />
                Waive OT & close (admin · staff forgot)
              </button>
            ) : isOver && !billClear ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                Waive OT needs food/play paid first — use Settle, or clear the tab.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
