"use client";

import { useV2Store } from "@/lib/v2/store";
import { X, Activity, Smartphone, User, Clock } from "lucide-react";

export function LiveAuditDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const auditEvents = useV2Store((s) => s.auditEvents);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                Live Audit Stream
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Who ordered, from which phone, when
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Timeline Events */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {auditEvents.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No events recorded yet. Actions taken across phones will appear here instantly.
            </div>
          ) : (
            auditEvents.map((evt) => {
              const date = new Date(evt.timestamp);
              const timeStr = date.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <div
                  key={evt.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {evt.title}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-slate-600 dark:text-slate-300">
                      <Clock className="h-3 w-3" /> {timeStr}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {evt.details}
                  </p>

                  <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/60">
                    <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                      <User className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      {evt.staffName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3 text-slate-400" />
                      {evt.deviceLabel}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
