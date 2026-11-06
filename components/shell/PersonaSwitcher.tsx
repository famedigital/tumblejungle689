"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Store, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

type PersonaId = "floor" | "cashier" | "admin";

interface PersonaItem {
  id: PersonaId;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, search: URLSearchParams) => boolean;
}

const PERSONAS: PersonaItem[] = [
  {
    id: "floor",
    label: "Play Floor",
    href: "/floor",
    icon: Timer,
    match: (pathname) => pathname.startsWith("/floor"),
  },
  {
    id: "cashier",
    label: "Cashier",
    href: "/cashier",
    icon: Store,
    match: (pathname) => pathname.startsWith("/cashier") || pathname.startsWith("/stickers"),
  },
  {
    id: "admin",
    label: "Owner",
    href: "/v2/admin",
    icon: LayoutDashboard,
    match: (pathname) => pathname.startsWith("/admin") || pathname.startsWith("/v2/admin"),
  },
];

/**
 * Bottom persona menu is admin-only.
 * Cashier / cafe / frontdesk stay on their till flow without office navigation.
 */
export function PersonaSwitcher() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        setIsAdmin(data?.session?.role === "admin");
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready || !isAdmin) return null;

  return (
    <nav
      aria-label="Staff persona"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 px-2 w-full max-w-[min(100%,42rem)]"
    >
      <div
        className={cn(
          "flex items-stretch justify-between gap-0.5 sm:gap-1 rounded-2xl p-1.5 sm:p-2",
          "bg-white/85 dark:bg-slate-900/80 backdrop-blur-2xl",
          "border border-slate-200/80 dark:border-white/10",
          "shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        )}
      >
        {PERSONAS.map((persona) => {
          const active = persona.match(pathname, searchParams);
          const Icon = persona.icon;
          return (
            <Link
              key={persona.id}
              href={persona.href}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 sm:px-2 py-1.5",
                "text-[10px] sm:text-xs font-bold leading-tight text-center transition-all duration-150",
                "hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0",
                active
                  ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/35"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate max-w-full">{persona.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
