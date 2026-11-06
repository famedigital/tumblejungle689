"use client";

import { useEffect, useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import { formatNu } from "@/lib/format";

export function DayMeters() {
  const todayNu = useV2Store((s) => s.todayNu);
  const playNu = useV2Store((s) => s.playNu);
  const foodNu = useV2Store((s) => s.foodNu);
  const visits = useV2Store((s) => s.visits);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const open = visits.filter((v) => v.status === "open");
  const kids = open.reduce((sum, v) => sum + (v.childCount || 0), 0);
  const overtime = open.filter(
    (v) => v.blocks.some((b) => b.paid) && new Date(v.paidUntil).getTime() < now,
  ).length;

  return (
    <div className="shrink-0 grid grid-cols-4 gap-px rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-slate-200/80 dark:bg-slate-800 shadow-sm">
      <Cell label="Today" value={formatNu(todayNu)} />
      <Cell label="Play" value={formatNu(playNu)} />
      <Cell label="Food" value={formatNu(foodNu)} />
      <Cell
        label="Floor"
        value={`${kids}`}
        hint={overtime > 0 ? `${overtime} over` : `${open.length} open`}
        alert={overtime > 0}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 px-3 py-2.5 ${
        alert ? "bg-rose-50 dark:bg-rose-950/40" : ""
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-bold font-mono tabular-nums ${
          alert ? "text-rose-700 dark:text-rose-300" : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className={`text-[10px] ${alert ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
