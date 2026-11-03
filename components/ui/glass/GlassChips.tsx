"use client";

import { cn } from "@/lib/utils";

export interface ChipOption<T = string | number> {
  value: T;
  label: string;
  subtext?: string;
}

interface GlassChipsProps<T = string | number> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export function GlassChips<T = string | number>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: GlassChipsProps<T>) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex flex-col items-center justify-center rounded-xl border text-center transition-all duration-150 cursor-pointer select-none",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
              isSelected
                ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white border-emerald-400 shadow-md shadow-emerald-500/20 scale-[1.02]"
                : "bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-slate-800",
            )}
          >
            <span className="font-bold">{opt.label}</span>
            {opt.subtext && (
              <span
                className={cn(
                  "text-[10px]",
                  isSelected ? "text-emerald-100" : "text-slate-500 dark:text-slate-400",
                )}
              >
                {opt.subtext}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
