"use client";

import { useV2Store } from "@/lib/v2/store";
import { User, Activity, RefreshCw } from "lucide-react";

export function TopBar({
  onOpenStaffModal,
  onOpenAudit,
}: {
  onOpenStaffModal: () => void;
  onOpenAudit: () => void;
}) {
  const staff = useV2Store((s) => s.staff);
  const isConnected = useV2Store((s) => s.isConnected);
  const venueName = useV2Store((s) => s.venueName);
  const auditEvents = useV2Store((s) => s.auditEvents);
  const bootstrap = useV2Store((s) => s.bootstrap);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 py-2.5 transition-colors">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {/* Brand & Live Pulse */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                {venueName || "Tumble Jungle"}
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                v2
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isConnected
                    ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                    : "bg-amber-500"
                }`}
              />
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                {isConnected ? "LIVE (0ms)" : "Connecting..."}
              </span>
            </div>
          </div>
        </div>

        {/* Staff badge & Audit drawer trigger */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => bootstrap()}
            title="Refresh state"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenAudit}
            title="Live Audit Log"
            className="relative p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Activity className="h-4 w-4" />
            {auditEvents.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                {auditEvents.length > 99 ? "99+" : auditEvents.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenStaffModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all text-xs text-slate-800 dark:text-slate-200 font-medium"
          >
            <div className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <User className="h-3 w-3" />
            </div>
            <span className="truncate max-w-[85px]">
              {staff?.staffName || "Set Staff"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
