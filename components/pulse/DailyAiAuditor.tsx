"use client";

import { useMemo } from "react";
import { AlertTriangle, MessageCircle, Send } from "lucide-react";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { formatNu } from "@/lib/format";

export type DailyAuditorSummary = {
  totalNu: number;
  cashNu: number;
  bankNu: number;
  playNu: number;
  foodNu: number;
  voidNu?: number;
  compNu?: number;
  settledCount?: number;
};

type Props = {
  summary: DailyAuditorSummary;
  venue?: string;
  ownerPhone?: string;
};

function buildShareText(summary: DailyAuditorSummary, venue: string): string {
  const lines = [
    `📊 ${venue} — End of day Pulse audit`,
    `Total: ${formatNu(summary.totalNu)}`,
    `Cash: ${formatNu(summary.cashNu)} · Bank QR: ${formatNu(summary.bankNu)}`,
    `Play: ${formatNu(summary.playNu)} · F&B: ${formatNu(summary.foodNu)}`,
  ];
  if (summary.voidNu != null && summary.voidNu > 0) lines.push(`Voids: ${formatNu(summary.voidNu)}`);
  if (summary.compNu != null && summary.compNu > 0) lines.push(`Comps: ${formatNu(summary.compNu)}`);
  if (summary.settledCount != null) lines.push(`Settled tickets: ${summary.settledCount}`);
  return lines.join("\n");
}

export function DailyAiAuditor({ summary, venue = "Tumble Jungle", ownerPhone }: Props) {
  const shareText = useMemo(() => buildShareText(summary, venue), [summary, venue]);

  const cashShare = summary.totalNu > 0 ? summary.cashNu / summary.totalNu : 0;
  const bankShare = summary.totalNu > 0 ? summary.bankNu / summary.totalNu : 0;
  const playShare = summary.totalNu > 0 ? summary.playNu / summary.totalNu : 0;
  const voidHigh = (summary.voidNu ?? 0) > Math.max(500, summary.totalNu * 0.05);

  const whatsAppUrl = ownerPhone
    ? `https://wa.me/${ownerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(shareText)}`
    : `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const telegramUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(shareText)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daily AI auditor</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{venue} · cash vs bank & play vs F&B</p>
        </div>
        {summary.settledCount != null ? (
          <GlassBadge tone="settled">{summary.settledCount} settled</GlassBadge>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard padding="md" variant="elevated">
          <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Tender mix</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatNu(summary.totalNu)}</p>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                <span>Cash</span>
                <span className="tabular-nums">{formatNu(summary.cashNu)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${Math.round(cashShare * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                <span>Bank QR</span>
                <span className="tabular-nums">{formatNu(summary.bankNu)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all"
                  style={{ width: `${Math.round(bankShare * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="md" variant="elevated">
          <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Revenue split</p>
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                <span>Play passes</span>
                <span className="tabular-nums">{formatNu(summary.playNu)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round(playShare * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                <span>Cafe & restaurant</span>
                <span className="tabular-nums">{formatNu(summary.foodNu)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{ width: `${Math.round((1 - playShare) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {voidHigh ? (
        <GlassCard padding="md" variant="tinted" className="border-amber-300/50 dark:border-amber-500/30">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Void anomaly</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Voids at {formatNu(summary.voidNu ?? 0)} exceed 5% of takings — review cashier overrides and KOT
                cancellations.
              </p>
            </div>
          </div>
        </GlassCard>
      ) : null}

      <GlassCard padding="md">
        <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Owner dispatch</p>
        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-100/80 p-3 text-sm text-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
          {shareText}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <GlassButton
            type="button"
            variant="emerald"
            size="lg"
            className="min-h-11 min-w-[44px]"
            onClick={() => window.open(whatsAppUrl, "_blank", "noopener,noreferrer")}
          >
            <MessageCircle className="size-5" aria-hidden />
            WhatsApp
          </GlassButton>
          <GlassButton
            type="button"
            variant="teal"
            size="lg"
            className="min-h-11 min-w-[44px]"
            onClick={() => window.open(telegramUrl, "_blank", "noopener,noreferrer")}
          >
            <Send className="size-5" aria-hidden />
            Telegram
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}
