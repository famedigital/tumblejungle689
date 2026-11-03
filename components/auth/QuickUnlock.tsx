"use client";

import { useCallback, useState } from "react";
import { Delete } from "lucide-react";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 4;

interface QuickUnlockProps {
  open: boolean;
  onUnlock: (pin: string) => Promise<boolean> | boolean;
  onClose?: () => void;
}

export function QuickUnlock({ open, onUnlock, onClose }: QuickUnlockProps) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitPin = useCallback(
    async (pin: string) => {
      if (pin.length !== PIN_LENGTH || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const ok = await onUnlock(pin);
        if (!ok) {
          setError("PIN not recognised. Try again.");
          setDigits("");
        }
      } catch {
        setError("Could not verify PIN. Try again.");
        setDigits("");
      } finally {
        setSubmitting(false);
      }
    },
    [onUnlock, submitting],
  );

  const appendDigit = (d: string) => {
    if (submitting || digits.length >= PIN_LENGTH) return;
    const next = digits + d;
    setDigits(next);
    setError(null);
    if (next.length === PIN_LENGTH) {
      void submitPin(next);
    }
  };

  const clearAll = () => {
    if (submitting) return;
    setDigits("");
    setError(null);
  };

  const backspace = () => {
    if (submitting) return;
    setDigits((prev) => prev.slice(0, -1));
    setError(null);
  };

  if (!open) return null;

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-unlock-title"
    >
      <GlassCard variant="elevated" padding="lg" className="w-full max-w-sm shadow-2xl">
        <div className="text-center space-y-2 mb-6">
          <h2
            id="quick-unlock-title"
            className="text-xl font-bold text-slate-900 dark:text-white font-[family-name:var(--font-heading)]"
          >
            Quick unlock
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter your 4-digit staff PIN
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-6" aria-live="polite">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full border-2 transition-colors",
                i < digits.length
                  ? "bg-emerald-500 border-emerald-500"
                  : "bg-transparent border-slate-300 dark:border-white/25",
              )}
              aria-hidden
            />
          ))}
        </div>

        {error ? (
          <p className="text-center text-sm font-semibold text-rose-600 dark:text-rose-400 mb-4" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {keys.map((key) => {
            if (key === "clear") {
              return (
                <button
                  key={key}
                  type="button"
                  disabled={submitting}
                  onClick={clearAll}
                  className={cn(
                    "min-h-11 min-w-11 rounded-2xl text-sm font-bold",
                    "text-slate-700 dark:text-slate-200",
                    "bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300/70 dark:border-white/15",
                    "hover:-translate-y-0.5 active:scale-[0.985] transition-all duration-150",
                    "disabled:opacity-50",
                  )}
                >
                  Clear
                </button>
              );
            }
            if (key === "back") {
              return (
                <button
                  key={key}
                  type="button"
                  disabled={submitting}
                  onClick={backspace}
                  aria-label="Backspace"
                  className={cn(
                    "min-h-11 min-w-11 rounded-2xl flex items-center justify-center",
                    "text-slate-700 dark:text-slate-200",
                    "bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300/70 dark:border-white/15",
                    "hover:-translate-y-0.5 active:scale-[0.985] transition-all duration-150",
                    "disabled:opacity-50",
                  )}
                >
                  <Delete className="w-5 h-5" aria-hidden />
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                disabled={submitting}
                onClick={() => appendDigit(key)}
                className={cn(
                  "min-h-11 min-w-11 rounded-2xl text-lg font-bold tabular-nums",
                  "text-slate-900 dark:text-white",
                  "bg-white/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/12",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                  "hover:-translate-y-0.5 active:scale-[0.985] transition-all duration-150",
                  "disabled:opacity-50",
                )}
              >
                {key}
              </button>
            );
          })}
        </div>

        {onClose ? (
          <div className="mt-4 flex justify-center">
            <GlassButton variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </GlassButton>
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}
