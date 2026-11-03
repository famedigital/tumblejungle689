"use client";

import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import {
  Lock,
  Mic,
  Moon,
  Search,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTheme } from "next-themes";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { cn } from "@/lib/utils";
import { isAudioMuted, setAudioMuted } from "@/lib/audio/sounds";

const THIMPHU_TZ = "Asia/Thimphu";

function formatThimphuClock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: THIMPHU_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatThimphuDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: THIMPHU_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export interface HeaderTopBarProps {
  outletLabel: string;
  activeJumpers?: number;
  capacity?: number;
  onSearch?: () => void;
  onVoice?: () => void;
  onLock?: () => void;
}

export function HeaderTopBar({
  outletLabel,
  activeJumpers,
  capacity,
  onSearch,
  onVoice,
  onLock,
}: HeaderTopBarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [now, setNow] = useState(() => new Date());
  const [muted, setMuted] = useState(() =>
    typeof window !== "undefined" ? isAudioMuted() : false,
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onSearch?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSearch]);

  const toggleMute = useCallback(() => {
    const next = !isAudioMuted();
    setAudioMuted(next);
    setMuted(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = resolvedTheme ?? theme ?? "light";
    setTheme(current === "dark" ? "light" : "dark");
  }, [resolvedTheme, theme, setTheme]);

  const showCapacity =
    typeof activeJumpers === "number" && typeof capacity === "number" && capacity > 0;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-white/10",
        "bg-white/75 dark:bg-slate-900/70 backdrop-blur-2xl",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white shadow-md shadow-emerald-600/25"
            aria-hidden
          >
            TJ
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">Tumble Jungle</p>
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {outletLabel}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-center text-center">
          <time
            dateTime={now.toISOString()}
            className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100"
          >
            {formatThimphuClock(now)}
          </time>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {formatThimphuDate(now)} · Thimphu
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          {showCapacity ? (
            <GlassBadge tone="active" className="hidden md:inline-flex mr-1">
              Active: {activeJumpers}/{capacity}
            </GlassBadge>
          ) : null}

          <HeaderIconButton
            label="Search"
            hint="Ctrl+K"
            onClick={onSearch}
            disabled={!onSearch}
          >
            <Search className="h-4 w-4" aria-hidden />
          </HeaderIconButton>

          <HeaderIconButton label="Voice till" onClick={onVoice} disabled={!onVoice}>
            <Mic className="h-4 w-4" aria-hidden />
          </HeaderIconButton>

          <HeaderIconButton
            label={muted ? "Unmute sounds" : "Mute sounds"}
            onClick={toggleMute}
            pressed={muted}
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
          </HeaderIconButton>

          <HeaderIconButton
            label={mounted && (resolvedTheme ?? theme) === "dark" ? "Light mode" : "Dark mode"}
            onClick={toggleTheme}
            disabled={!mounted}
          >
            {mounted && (resolvedTheme ?? theme) === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </HeaderIconButton>

          <HeaderIconButton label="Quick lock" onClick={onLock} disabled={!onLock}>
            <Lock className="h-4 w-4" aria-hidden />
          </HeaderIconButton>
        </div>
      </div>

      {showCapacity ? (
        <div className="flex justify-center pb-2 md:hidden">
          <GlassBadge tone="active">Active: {activeJumpers}/{capacity}</GlassBadge>
        </div>
      ) : null}
    </header>
  );
}

function HeaderIconButton({
  children,
  label,
  hint,
  onClick,
  disabled,
  pressed,
}: {
  children: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={hint ? `${label} (${hint})` : label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl",
        "text-slate-700 dark:text-slate-200",
        "border border-slate-200/80 dark:border-white/10",
        "bg-slate-100/60 dark:bg-slate-800/50",
        "hover:-translate-y-0.5 hover:bg-slate-200/70 dark:hover:bg-slate-700/60",
        "active:scale-[0.985] active:translate-y-0 transition-all duration-150",
        "disabled:opacity-40 disabled:pointer-events-none",
        pressed && "ring-2 ring-amber-400/50 bg-amber-50/80 dark:bg-amber-950/40",
      )}
    >
      {children}
    </button>
  );
}
