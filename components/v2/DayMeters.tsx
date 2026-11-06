"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useV2Store } from "@/lib/v2/store";
import { formatNu } from "@/lib/format";
import { Banknote, Clock, Footprints, Utensils } from "lucide-react";

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
  const ending = open.filter((v) => {
    if (!v.blocks.some((b) => b.paid)) return false;
    const left = Math.round((new Date(v.paidUntil).getTime() - now) / 60000);
    return left >= 0 && left <= 10;
  }).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
      <Meter
        label="Today"
        value={formatNu(todayNu)}
        icon={<Banknote className="h-3.5 w-3.5" />}
        tone="emerald"
      />
      <Meter
        label="Play"
        value={formatNu(playNu)}
        icon={<Footprints className="h-3.5 w-3.5" />}
        tone="sky"
      />
      <Meter
        label="Food"
        value={formatNu(foodNu)}
        icon={<Utensils className="h-3.5 w-3.5" />}
        tone="violet"
      />
      <Meter
        label="Floor"
        value={`${kids} kids`}
        hint={
          overtime > 0
            ? `${overtime} overtime`
            : ending > 0
              ? `${ending} ending soon`
              : `${open.length} open`
        }
        icon={<Clock className="h-3.5 w-3.5" />}
        tone={overtime > 0 ? "rose" : ending > 0 ? "amber" : "teal"}
      />
    </div>
  );
}

const TONE: Record<
  string,
  { wrap: string; label: string; value: string; icon: string; hint: string }
> = {
  emerald: {
    wrap: "border-emerald-200/80 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900",
    label: "text-emerald-700 dark:text-emerald-400",
    value: "text-slate-900 dark:text-white",
    icon: "text-emerald-600 dark:text-emerald-400",
    hint: "text-emerald-700/70 dark:text-emerald-400/70",
  },
  sky: {
    wrap: "border-sky-200/80 dark:border-sky-900/50 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/40 dark:to-slate-900",
    label: "text-sky-700 dark:text-sky-400",
    value: "text-slate-900 dark:text-white",
    icon: "text-sky-600 dark:text-sky-400",
    hint: "text-sky-700/70 dark:text-sky-400/70",
  },
  violet: {
    wrap: "border-violet-200/80 dark:border-violet-900/50 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 dark:to-slate-900",
    label: "text-violet-700 dark:text-violet-400",
    value: "text-slate-900 dark:text-white",
    icon: "text-violet-600 dark:text-violet-400",
    hint: "text-violet-700/70 dark:text-violet-400/70",
  },
  teal: {
    wrap: "border-teal-200/80 dark:border-teal-900/50 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/40 dark:to-slate-900",
    label: "text-teal-700 dark:text-teal-400",
    value: "text-slate-900 dark:text-white",
    icon: "text-teal-600 dark:text-teal-400",
    hint: "text-teal-700/70 dark:text-teal-400/70",
  },
  amber: {
    wrap: "border-amber-300/80 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-900",
    label: "text-amber-800 dark:text-amber-300",
    value: "text-amber-950 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-400",
    hint: "text-amber-700 dark:text-amber-300",
  },
  rose: {
    wrap: "border-rose-300/80 dark:border-rose-900/50 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 dark:to-slate-900 ring-1 ring-rose-500/15",
    label: "text-rose-800 dark:text-rose-300",
    value: "text-rose-950 dark:text-rose-100",
    icon: "text-rose-600 dark:text-rose-400",
    hint: "text-rose-700 dark:text-rose-300",
  },
};

function Meter({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone: keyof typeof TONE;
}) {
  const t = TONE[tone];
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${t.wrap}`}>
      <div className="flex items-center justify-between gap-1">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${t.label}`}>{label}</p>
        <span className={t.icon}>{icon}</span>
      </div>
      <p className={`mt-0.5 text-sm font-bold font-mono tabular-nums ${t.value}`}>{value}</p>
      {hint ? <p className={`text-[10px] font-medium ${t.hint}`}>{hint}</p> : null}
    </div>
  );
}
