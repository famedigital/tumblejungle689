"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, LogOut, MessageCircle, Plus } from "lucide-react";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { playTimeUpWarning } from "@/lib/audio/sounds";
import { formatNu, minutesLeft } from "@/lib/format";
import { whatsAppChat } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export type FloorVisit = {
  code: string;
  guardianName: string;
  childCount: number;
  paidUntil: string;
  phone: string;
  dueNu?: number;
};

export interface FloorRadarViewProps {
  visits: FloorVisit[];
  capacity?: number;
  onExtend?: (code: string, minutes: number) => void;
  onLeave?: (code: string) => void;
  now?: number;
  venueName?: string;
}

type VisitTone = "active" | "warning" | "overtime";

function visitTone(paidUntil: string, now: number, dueNu?: number): VisitTone {
  const left = minutesLeft(paidUntil, now);
  if (left <= 0 || (dueNu !== undefined && dueNu > 0)) return "overtime";
  if (left <= 15) return "warning";
  return "active";
}

function CapacityRing({ percent, jumpers, capacity }: { percent: number; jumpers: number; capacity: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, percent) / 100) * c;
  const stroke =
    percent >= 90 ? "#f43f5e" : percent >= 75 ? "#f59e0b" : "#10b981";

  return (
    <div className="relative flex size-36 items-center justify-center sm:size-40">
      <svg className="-rotate-90 size-full" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-200/80 dark:text-slate-800" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">{jumpers}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          / {capacity}
        </span>
        <span className="text-xs text-slate-600 dark:text-slate-300">{Math.round(percent)}%</span>
      </div>
    </div>
  );
}

function waLink(phone: string, venue: string, minutesOver: number): string {
  try {
    return whatsAppChat(phone, venue, minutesOver);
  } catch {
    const digits = phone.replace(/\D/g, "").slice(-8);
    const text = encodeURIComponent(`Hi, play time at ${venue} is ending soon. Please collect your children.`);
    return `https://wa.me/975${digits}?text=${text}`;
  }
}

export function FloorRadarView({
  visits,
  capacity = 40,
  onExtend,
  onLeave,
  now: nowProp,
  venueName = "Tumble Jungle",
}: FloorRadarViewProps) {
  const [tick, setTick] = useState(() => Date.now());
  const warnedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const now = nowProp ?? tick;
  const jumpers = useMemo(() => visits.reduce((sum, v) => sum + v.childCount, 0), [visits]);
  const percent = capacity > 0 ? (jumpers / capacity) * 100 : 0;

  useEffect(() => {
    for (const visit of visits) {
      const tone = visitTone(visit.paidUntil, now, visit.dueNu);
      if (tone === "warning" && !warnedRef.current.has(visit.code)) {
        warnedRef.current.add(visit.code);
        playTimeUpWarning();
      }
      if (tone === "active" && minutesLeft(visit.paidUntil, now) > 15) {
        warnedRef.current.delete(visit.code);
      }
    }
  }, [visits, now]);

  return (
    <div className="flex flex-col gap-5">
      <GlassCard padding="lg" className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Play floor radar</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {visits.length} active visit{visits.length === 1 ? "" : "s"} · live countdown
          </p>
        </div>
        <CapacityRing percent={percent} jumpers={jumpers} capacity={capacity} />
      </GlassCard>

      {visits.length === 0 ? (
        <GlassCard padding="lg">
          <p className="text-center text-sm text-slate-600 dark:text-slate-300">The floor is clear — no active jumpers.</p>
        </GlassCard>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visits.map((visit) => {
            const left = minutesLeft(visit.paidUntil, now);
            const tone = visitTone(visit.paidUntil, now, visit.dueNu);
            const minutesOver = left < 0 ? Math.abs(left) : 0;
            const badgeTone = tone === "overtime" ? "overtime" : tone === "warning" ? "warning" : "active";

            return (
              <li key={visit.code}>
                <GlassCard
                  padding="md"
                  variant={tone === "overtime" ? "active" : "default"}
                  className={cn(
                    "flex h-full flex-col gap-3",
                    tone === "overtime" && "animate-pulse border-rose-400/50 dark:border-rose-500/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900 dark:text-white">{visit.guardianName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {visit.code} · {visit.childCount} jumper{visit.childCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    <GlassBadge tone={badgeTone} dot>
                      {tone === "overtime"
                        ? left <= 0
                          ? `+${minutesOver}m`
                          : "Due"
                        : `${left}m left`}
                    </GlassBadge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <Clock className="size-4 shrink-0 opacity-70" aria-hidden />
                    {tone === "overtime" && visit.dueNu !== undefined && visit.dueNu > 0 ? (
                      <span className="font-bold text-rose-700 dark:text-rose-300">{formatNu(visit.dueNu)} overtime</span>
                    ) : (
                      <span>
                        {left > 0 ? `${left} minutes remaining` : `${minutesOver} min overtime`}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2">
                    {onExtend ? (
                      <GlassButton
                        type="button"
                        variant="teal"
                        size="sm"
                        onClick={() => onExtend(visit.code, 30)}
                      >
                        <Plus className="size-3.5" />
                        +30
                      </GlassButton>
                    ) : null}
                    {onLeave ? (
                      <GlassButton type="button" variant="slate" size="sm" onClick={() => onLeave(visit.code)}>
                        <LogOut className="size-3.5" />
                        Leave
                      </GlassButton>
                    ) : null}
                    <GlassButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(waLink(visit.phone, venueName, minutesOver), "_blank", "noopener,noreferrer")}
                    >
                      <MessageCircle className="size-3.5" />
                      WhatsApp
                    </GlassButton>
                  </div>
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
