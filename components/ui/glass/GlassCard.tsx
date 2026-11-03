import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "elevated" | "tinted" | "active";
  className?: string;
}

const PAD: Record<NonNullable<GlassCardProps["padding"]>, string> = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function GlassCard({
  children,
  interactive = false,
  padding = "md",
  variant = "default",
  className,
  ...rest
}: GlassCardProps) {
  const variantStyles = {
    default: "bg-white/85 dark:bg-slate-900/75 border-slate-200/80 dark:border-white/10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]",
    elevated: "bg-white/95 dark:bg-slate-900/85 border-slate-200 dark:border-white/15 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)]",
    tinted: "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-500/20 shadow-sm",
    active: "bg-white/95 dark:bg-slate-900/90 border-teal-500/50 dark:border-teal-400/50 ring-2 ring-teal-500/20 shadow-md",
  }[variant];

  return (
    <div
      className={cn(
        "relative rounded-2xl border backdrop-blur-xl transition-all duration-200 ease-out",
        variantStyles,
        interactive &&
          "hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.985] active:translate-y-0 cursor-pointer select-none",
        PAD[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
