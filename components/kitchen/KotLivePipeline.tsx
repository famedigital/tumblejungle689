"use client";

import { useMemo } from "react";
import { ArrowRight, ChefHat } from "lucide-react";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { playKotBell } from "@/lib/audio/sounds";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

export type KotStatus = "fired" | "prep" | "ready" | "delivered";

export type KotTicket = {
  id: string;
  code: string;
  tableNo: string;
  lines: { name: string; qty: number }[];
  status: KotStatus;
  firedAt: string;
};

export interface KotLivePipelineProps {
  tickets: KotTicket[];
  onBump: (id: string, nextStatus: KotStatus) => void;
}

const COLUMNS: { status: KotStatus; title: string; tone: "kot" | "warning" | "active" | "settled" }[] = [
  { status: "fired", title: "Fired", tone: "kot" },
  { status: "prep", title: "In prep", tone: "warning" },
  { status: "ready", title: "Ready", tone: "active" },
  { status: "delivered", title: "Delivered", tone: "settled" },
];

const NEXT: Record<KotStatus, KotStatus | null> = {
  fired: "prep",
  prep: "ready",
  ready: "delivered",
  delivered: null,
};

const BUMP_LABEL: Record<KotStatus, string> = {
  fired: "Start prep",
  prep: "Mark ready",
  ready: "Picked up",
  delivered: "Done",
};

function elapsedMinutes(firedAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(firedAt).getTime()) / 60_000));
}

export function KotLivePipeline({ tickets, onBump }: KotLivePipelineProps) {
  const byColumn = useMemo(() => {
    const map: Record<KotStatus, KotTicket[]> = {
      fired: [],
      prep: [],
      ready: [],
      delivered: [],
    };
    for (const ticket of tickets) {
      map[ticket.status]?.push(ticket);
    }
    for (const col of COLUMNS) {
      map[col.status].sort((a, b) => new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime());
    }
    return map;
  }, [tickets]);

  function handleBump(ticket: KotTicket) {
    const next = NEXT[ticket.status];
    if (!next) return;
    if (ticket.status === "fired" && next === "prep") {
      playKotBell();
    }
    onBump(ticket.id, next);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
          <ChefHat className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Kitchen KOT pipeline</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Bump tickets across the line · bell on new prep</p>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <section key={col.status} className="flex min-h-[320px] flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">{col.title}</h2>
              <GlassBadge tone={col.tone}>{byColumn[col.status].length}</GlassBadge>
            </div>
            <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-dashed border-slate-300/60 bg-slate-100/40 p-2 dark:border-white/10 dark:bg-slate-900/30">
              {byColumn[col.status].length === 0 ? (
                <p className="m-auto px-2 text-center text-xs text-slate-500 dark:text-slate-400">No tickets</p>
              ) : (
                byColumn[col.status].map((ticket) => {
                  const next = NEXT[ticket.status];
                  const mins = elapsedMinutes(ticket.firedAt);
                  return (
                    <GlassCard key={ticket.id} padding="md" className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{ticket.code}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {ticket.tableNo} · fired {formatClock(ticket.firedAt)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-lg px-2 py-0.5 text-xs font-bold",
                            mins >= 20
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                              : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                          )}
                        >
                          {mins}m
                        </span>
                      </div>
                      <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                        {ticket.lines.map((line, i) => (
                          <li key={`${line.name}-${i}`}>
                            {line.qty}× {line.name}
                          </li>
                        ))}
                      </ul>
                      {next ? (
                        <GlassButton type="button" variant="teal" size="sm" className="w-full" onClick={() => handleBump(ticket)}>
                          {BUMP_LABEL[ticket.status]}
                          <ArrowRight className="size-4" />
                        </GlassButton>
                      ) : (
                        <p className="text-center text-xs text-slate-500 dark:text-slate-400">Complete</p>
                      )}
                    </GlassCard>
                  );
                })
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
