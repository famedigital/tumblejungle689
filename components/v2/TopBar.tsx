"use client";

import { useEffect, useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import Link from "next/link";
import { User, Activity, RefreshCw, LayoutDashboard, LogOut } from "lucide-react";

export function TopBar({
  onOpenStaffModal,
  onOpenAudit,
  onOpenAdmin,
}: {
  onOpenStaffModal: () => void;
  onOpenAudit: () => void;
  onOpenAdmin: () => void;
}) {
  const staff = useV2Store((s) => s.staff);
  const isConnected = useV2Store((s) => s.isConnected);
  const venueName = useV2Store((s) => s.venueName);
  const auditEvents = useV2Store((s) => s.auditEvents);
  const bootstrap = useV2Store((s) => s.bootstrap);
  const [sessionIsAdmin, setSessionIsAdmin] = useState(false);
  const isAdmin = sessionIsAdmin;

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        setSessionIsAdmin(data?.session?.role === "admin");
      })
      .catch(() => {
        if (alive) setSessionIsAdmin(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 md:px-6 py-2.5 transition-colors">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Brand & Live Pulse */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm md:text-base tracking-tight text-slate-900 dark:text-white truncate">
                {venueName || "Tumble Jungle"}
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                v2
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isConnected
                    ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                    : "bg-amber-500"
                }`}
              />
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                {isConnected ? "LIVE" : "Connecting..."}
              </span>
            </div>
          </div>

          {/* Desktop Direct Links — admin only */}
          {isAdmin ? (
            <nav className="hidden md:flex items-center gap-1 ml-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Link
                href="/v2/admin?tab=menu"
                className="px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Menu & Prices
              </Link>
              <Link
                href="/v2/admin?tab=stock"
                className="px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Stock
              </Link>
              <Link
                href="/v2/admin?tab=sales"
                className="px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Day Sales
              </Link>
              <Link
                href="/v2/admin?tab=staff"
                className="px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Staff & PINs
              </Link>
              <a
                href="/display"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-emerald-600 dark:text-emerald-400"
              >
                Counter Display
              </a>
            </nav>
          ) : null}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {isAdmin ? (
            <button
              type="button"
              onClick={onOpenAdmin}
              title="Admin & Store Management"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Admin Hub</span>
            </button>
          ) : null}

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
            <span className="truncate max-w-[70px] sm:max-w-[120px]">
              {staff?.staffName || "Set Staff"}
            </span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            title="Sign Out / Lock Station"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
