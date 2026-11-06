"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee, MapPinned, Sparkles } from "lucide-react";

const NAV = [
  {
    href: "/play",
    label: "Play",
    hint: "Soft play & passes",
    icon: Sparkles,
  },
  {
    href: "/eat",
    label: "Cafe & Restaurant",
    short: "Eat",
    hint: "Family dining",
    icon: Coffee,
  },
  {
    href: "/visit",
    label: "Your Visit",
    short: "Visit",
    hint: "Live pass timer",
    icon: MapPinned,
  },
] as const;

export function SiteNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Main" className="w-full">
      <ul className="flex items-stretch gap-1 sm:gap-1.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const short = "short" in item ? item.short : item.label;
          return (
            <li key={item.href} className="min-w-0 flex-1 sm:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative flex h-11 sm:h-12 items-center justify-center gap-2 rounded-2xl px-3 sm:px-5",
                  "text-[13px] sm:text-sm font-extrabold tracking-tight transition-all duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a008]",
                  active
                    ? "bg-[#146047] text-[#f7f4ee] shadow-[0_10px_24px_-12px_rgba(20,96,71,0.55)]"
                    : "bg-[#efeae2]/80 text-[#1c2420] hover:bg-white hover:text-[#146047] hover:-translate-y-0.5 active:scale-[0.985]",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "hidden sm:block h-4 w-4 shrink-0 transition-colors",
                    active ? "text-[#e2a008]" : "text-[#146047]/70 group-hover:text-[#146047]",
                  ].join(" ")}
                  aria-hidden
                />
                <span className="truncate sm:hidden">{short}</span>
                <span className="hidden sm:inline truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
