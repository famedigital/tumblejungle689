"use client";

import { Activity, Clock3, DollarSign, UtensilsCrossed } from "lucide-react";
import { formatNu } from "@/lib/format";

interface BentoDeckProps {
  takingsNu: number;
  cashNu: number;
  bankNu: number;
  activeJumpers: number;
  maxCapacity?: number;
  overtimeCount: number;
  activeKotOrders: number;
}

export function AtherosBentoDeck({
  takingsNu,
  cashNu,
  bankNu,
  activeJumpers,
  maxCapacity = 45,
  overtimeCount,
  activeKotOrders,
}: BentoDeckProps) {
  const capacityPct = Math.min(100, Math.round((activeJumpers / maxCapacity) * 100));
  const bankPct = takingsNu > 0 ? Math.round((bankNu / takingsNu) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Takings Card */}
      <div className="glass-panel glass-interactive relative rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Today&apos;s Takings
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="tabular-nums-dense font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {formatNu(takingsNu)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>Cash: {formatNu(cashNu)}</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Bank QR: {bankPct}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. Active Jumpers & Capacity Ring */}
      <div className="glass-panel glass-interactive relative rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Floor Capacity
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Activity className="size-4" />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="tabular-nums-dense font-mono text-2xl font-bold text-slate-900 dark:text-white">
              {activeJumpers} <span className="text-sm font-normal text-slate-500">/ {maxCapacity}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Active inside park</p>
          </div>
          {/* Circular SVG Ring */}
          <div className="relative size-12 shrink-0">
            <svg className="size-12 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={capacityPct > 85 ? "text-rose-500" : "text-teal-500"}
                strokeDasharray={`${capacityPct}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="tabular-nums-dense absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
              {capacityPct}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. Overtime Radar */}
      <div className="glass-panel glass-interactive relative rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Overtime Radar
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock3 className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="tabular-nums-dense font-mono text-2xl font-bold text-slate-900 dark:text-white">
            {overtimeCount}{" "}
            <span className="text-xs font-semibold text-rose-500 dark:text-rose-400">
              {overtimeCount > 0 ? "Jumpers Overdue" : "All on time"}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {overtimeCount > 0 ? "Requires settlement or pass extension" : "Zero unpaid play minutes"}
          </p>
        </div>
      </div>

      {/* 4. Kitchen KOT Queue */}
      <div className="glass-panel glass-interactive relative rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Kitchen KOT Queue
          </span>
          <div className="flex size-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <UtensilsCrossed className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="tabular-nums-dense font-mono text-2xl font-bold text-slate-900 dark:text-white">
            {activeKotOrders}{" "}
            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
              {activeKotOrders === 1 ? "Active Order" : "Active Orders"}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Cafe snacks & restaurant dining in prep
          </p>
        </div>
      </div>
    </div>
  );
}
