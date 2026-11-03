import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "active" | "warning" | "overtime" | "settled" | "kot" | "neutral";

interface GlassBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}

const TONES: Record<Tone, { badge: string; dot: string }> = {
  active: {
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500 animate-pulse",
  },
  warning: {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
  },
  overtime: {
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
    dot: "bg-rose-500 animate-ping",
  },
  settled: {
    badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
    dot: "bg-slate-400",
  },
  kot: {
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
    dot: "bg-violet-500",
  },
  neutral: {
    badge: "bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300/60 dark:border-white/10",
    dot: "bg-slate-400",
  },
};

export function GlassBadge({
  children,
  tone = "neutral",
  dot = false,
  className,
  ...rest
}: GlassBadgeProps) {
  const current = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-md",
        current.badge,
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn("size-1.5 rounded-full", current.dot)} aria-hidden />}
      {children}
    </span>
  );
}
