"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "emerald" | "amber" | "teal" | "rose" | "slate" | "ghost";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
}

const VARIANT: Record<Variant, string> = {
  emerald:
    "text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 border border-emerald-400/30",
  amber:
    "text-amber-950 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 shadow-md shadow-amber-500/20 border border-amber-300/40",
  teal:
    "text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 shadow-md shadow-teal-500/20 border border-teal-300/30",
  rose:
    "text-white bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 shadow-md shadow-rose-500/20 border border-rose-300/30",
  slate:
    "text-slate-800 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/90 dark:hover:bg-slate-700/90 border border-slate-300/70 dark:border-white/15 shadow-sm",
  ghost:
    "text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/10 border border-transparent",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs rounded-xl",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-5 py-3 text-base rounded-2xl",
};

export function GlassButton({
  children,
  variant = "emerald",
  size = "md",
  loading = false,
  className,
  disabled,
  ...rest
}: GlassButtonProps) {
  const { type = "button", ...btnRest } = rest;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold cursor-pointer select-none transition-all duration-150 ease-out",
        "hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
        VARIANT[variant],
        SIZES[size],
        className,
      )}
      {...btnRest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
