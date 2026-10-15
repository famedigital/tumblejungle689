"use client";

import { useEffect, type KeyboardEvent, type ReactNode } from "react";
import { PlaytabCredit } from "@/components/playtab-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TillShell({
  scanAction,
  scanDefault,
  scanValue,
  onScanChange,
  onFind,
  onScanKeyDown,
  scanExtra,
  scanPlaceholder = "Phone or ticket",
  inputMode,
  hideScan = false,
  onOpenFind,
  dueEyebrow,
  dueValue,
  dueHint,
  status,
  statusBad = false,
  info,
  lead,
  tools,
  footer,
  touch,
  headClass,
  children,
}: {
  scanAction: string;
  scanDefault?: string;
  scanValue?: string;
  onScanChange?: (value: string) => void;
  onFind?: (value: string) => void;
  onScanKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  scanExtra?: ReactNode;
  scanPlaceholder?: string;
  inputMode?: "none" | "text" | "numeric";
  hideScan?: boolean;
  onOpenFind?: () => void;
  dueEyebrow: string;
  dueValue: string;
  dueHint: string;
  status: string;
  statusBad?: boolean;
  info?: ReactNode;
  lead?: ReactNode;
  tools?: ReactNode;
  footer?: ReactNode;
  touch?: string;
  headClass?: string;
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
      <header className={`till-head border-b border-border bg-card px-3 py-2${tools ? " till-head-tools" : ""}${headClass ? ` ${headClass}` : ""}${hideScan ? " till-head-noscan" : ""}`}>
        {hideScan ? (
          <div className="till-scan flex items-center gap-1.5">
            {lead}
            <Button type="button" variant="outline" className="h-10 min-w-0 flex-1 justify-start px-3 font-normal text-muted-foreground" onClick={onOpenFind}>
              Find phone or ticket
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">Ctrl+K</kbd>
            </Button>
            {scanExtra}
          </div>
        ) : (
        <form
          action={onFind ? undefined : scanAction}
          className="till-scan flex items-center gap-1.5"
          onSubmit={(event) => {
            if (!onFind) return;
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            onFind(String(data.get("q") ?? ""));
            event.currentTarget.reset();
          }}
        >
          {lead}
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
              onKeyDown={onScanKeyDown}
              className="h-10 bg-background text-base"
            />
          </label>
          <Button type="submit" className="h-10 shrink-0 px-3">
            Find
          </Button>
          {scanExtra}
        </form>
        )}
        <div className="till-beside">
          <p className={`till-status truncate text-sm ${statusBad ? "text-destructive" : "text-muted-foreground"}`}>{status}</p>
          {info}
        </div>
        {tools ? <div className="till-tools">{tools}</div> : null}
        <div className="till-due rounded-xl bg-secondary px-3 py-1.5 text-right">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{dueEyebrow}</p>
          <p className="font-heading text-2xl leading-none text-primary tabular-nums">{dueValue}</p>
          <p className="max-w-40 truncate text-xs text-muted-foreground">{dueHint}</p>
        </div>
      </header>
      <div className="till-body flex min-h-0 flex-1 flex-col">{children}</div>
      {footer ? (
        <footer className="grid auto-cols-fr grid-flow-col gap-1 border-t border-border bg-card p-2">{footer}</footer>
      ) : null}
      <PlaytabCredit className="border-t border-border bg-card px-3 py-1.5 text-muted-foreground" />
    </div>
  );
}
