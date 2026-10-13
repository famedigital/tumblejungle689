"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TillShell({
  scanAction,
  scanDefault,
  scanValue,
  onScanChange,
  scanPlaceholder = "Phone or ticket",
  inputMode,
  dueEyebrow,
  dueValue,
  dueHint,
  status,
  statusBad = false,
  tools,
  footer,
  touch,
  children,
}: {
  scanAction: string;
  scanDefault?: string;
  scanValue?: string;
  onScanChange?: (value: string) => void;
  scanPlaceholder?: string;
  inputMode?: "none" | "text" | "numeric";
  dueEyebrow: string;
  dueValue: string;
  dueHint: string;
  status: string;
  statusBad?: boolean;
  tools?: ReactNode;
  footer?: ReactNode;
  touch?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.surface;
    root.dataset.surface = "till";
    return () => {
      if (previous) root.dataset.surface = previous;
      else delete root.dataset.surface;
    };
  }, []);

  return (
    <div data-surface="till" data-touch={touch} className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2">
        <form action={scanAction} className="flex min-w-0 flex-1 items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Scan</span>
            <Input
              name="q"
              autoFocus
              autoComplete="off"
              inputMode={inputMode}
              aria-label="Phone or ticket"
              placeholder={scanPlaceholder}
              defaultValue={onScanChange ? undefined : (scanDefault ?? "")}
              value={onScanChange ? scanValue : undefined}
              onChange={onScanChange ? (event) => onScanChange(event.target.value) : undefined}
              className="h-12 bg-background text-base"
            />
          </label>
          <Button type="submit" className="h-12 px-4">
            Find
          </Button>
        </form>
        <div className="shrink-0 rounded-xl bg-secondary px-3 py-1.5 text-right">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{dueEyebrow}</p>
          <p className="font-heading text-2xl leading-none text-primary tabular-nums">{dueValue}</p>
          <p className="max-w-40 truncate text-xs text-muted-foreground">{dueHint}</p>
        </div>
      </header>
      <div className="till-tools flex flex-wrap items-center gap-2 border-b border-border bg-card/80 px-3 py-2">
        <p className={`min-w-0 flex-1 truncate text-sm ${statusBad ? "text-destructive" : "text-foreground"}`}>{status}</p>
        {tools}
      </div>
      <div className="till-body flex min-h-0 flex-1 flex-col">{children}</div>
      {footer ? (
        <footer className="grid auto-cols-fr grid-flow-col gap-1 border-t border-border bg-card p-2">{footer}</footer>
      ) : null}
    </div>
  );
}
