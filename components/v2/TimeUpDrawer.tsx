"use client";

import { useEffect, useMemo, useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import type { VisitView } from "@/lib/types";
import { formatPhone } from "@/lib/format";
import { whatsAppChat, rememberChat, sentIdsFrom, readSentSnapshot } from "@/lib/whatsapp";
import { AlertTriangle, X, MessageCircle, QrCode, Timer } from "lucide-react";

export function TimeUpDrawer({
  isOpen,
  onClose,
  onSettle,
  onExtend,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSettle: (visit: VisitView) => void;
  onExtend?: (visit: VisitView) => void;
}) {
  const visits = useV2Store((s) => s.visits);
  const venueName = useV2Store((s) => s.venueName);
  const [sentSnap, setSentSnap] = useState(() => readSentSnapshot());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  const rows = useMemo(() => {
    return visits
      .filter((v) => v.status === "open" && v.blocks.some((b) => b.paid) && !String(v.phone || "").startsWith("F"))
      .map((item) => ({
        item,
        left: Math.round((new Date(item.paidUntil).getTime() - now) / 60000),
      }))
      .filter((row) => row.left < 0)
      .sort((a, b) => a.left - b.left);
  }, [visits, now]);

  const ending = useMemo(() => {
    return visits
      .filter((v) => v.status === "open" && v.blocks.some((b) => b.paid))
      .map((item) => ({
        item,
        left: Math.round((new Date(item.paidUntil).getTime() - now) / 60000),
      }))
      .filter((row) => row.left >= 0 && row.left <= 10)
      .sort((a, b) => a.left - b.left);
  }, [visits, now]);

  const sentIds = sentIdsFrom(sentSnap);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">
              Time&apos;s up · {rows.length}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <section className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Overtime</p>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No overtime right now.</p>
            ) : (
              rows.map(({ item, left }) => {
                const over = Math.abs(left);
                const sent = sentIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {item.guardianName || formatPhone(item.phone)}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {item.code} · {formatPhone(item.phone)} · {item.childCount} kid
                          {item.childCount === 1 ? "" : "s"} · {over}m over
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300">
                        {over}m
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={whatsAppChat(item.phone, venueName || "Tumble Jungle", over)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => {
                          rememberChat(item.id);
                          setSentSnap(readSentSnapshot());
                        }}
                        className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-200"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {sent ? "Sent" : "WhatsApp"}
                      </a>
                      {onExtend ? (
                        <button
                          type="button"
                          onClick={() => {
                            onExtend(item);
                            onClose();
                          }}
                          className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Timer className="h-3.5 w-3.5" /> Fix / Extend
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          onSettle(item);
                          onClose();
                        }}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <QrCode className="h-3.5 w-3.5" /> Settle
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
              Ending soon (≤10m) · {ending.length}
            </p>
            {ending.length === 0 ? (
              <p className="text-sm text-slate-500 py-2 text-center">None ending soon.</p>
            ) : (
              ending.map(({ item, left }) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSettle(item);
                    onClose();
                  }}
                  className="w-full text-left rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2.5"
                >
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.code} · {item.guardianName || formatPhone(item.phone)}
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">{left}m left</p>
                </button>
              ))
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
