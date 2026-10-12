"use client";

import { useMemo, useState } from "react";
import { formatNu } from "@/lib/format";
import type { MenuItem, Outlet } from "@/lib/types";

const SWATCHES = [
  "bg-[#fff1c9] ring-[#f0c14b]",
  "bg-[#d9f6ef] ring-[#3cbaa6]",
  "bg-[#d9f3ff] ring-[#49b6e8]",
  "bg-[#ffe1dc] ring-[#ef7a6a]",
  "bg-[#f3e4ff] ring-[#b07adf]",
];

export function MenuBoard({ items }: { items: MenuItem[] }) {
  const [outlet, setOutlet] = useState<"all" | Outlet>("all");
  const [category, setCategory] = useState("All");
  const [openId, setOpenId] = useState<number | null>(null);

  const visible = useMemo(
    () => items.filter((item) => outlet === "all" || item.outlet === outlet),
    [items, outlet],
  );
  const categories = ["All", ...new Set(visible.map((item) => item.category))];
  const shown = visible.filter((item) => category === "All" || item.category === category);

  function chooseOutlet(next: "all" | Outlet) {
    setOutlet(next);
    setCategory("All");
    setOpenId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Where to eat">
        {(
          [
            ["all", "Everything"],
            ["cafe", "Cafe"],
            ["restaurant", "Restaurant"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={outlet === value}
            onClick={() => chooseOutlet(value)}
            className={`h-11 rounded-full px-4 text-sm font-medium transition ${
              outlet === value ? "bg-[#1f7a5a] text-white" : "bg-white text-[#1f4d3a] ring-1 ring-[#1f4d3a]/15 hover:bg-[#e7f7f1]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setCategory(name)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              category === name ? "bg-[#ffb703] text-[#3d2a00]" : "bg-white ring-1 ring-foreground/10 hover:bg-[#fff6dd]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item, index) => {
          const open = openId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : item.id)}
                className={`flex h-full w-full flex-col items-start rounded-2xl p-4 text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${SWATCHES[index % SWATCHES.length]}`}
              >
                <span className="text-xs font-medium uppercase tracking-wide text-[#1f4d3a]/70">
                  {item.outlet} · {item.category}
                </span>
                <span className="mt-1 font-heading text-2xl">{item.name}</span>
                <span className="mt-2 rounded-full bg-white/80 px-2 py-0.5 text-sm font-medium">{formatNu(item.priceNu)}</span>
                {open ? (
                  <span className="mt-3 text-sm leading-relaxed text-[#1f4d3a]">
                    Added to the family tab when the counter scans your play ticket. Pay here, or clear it with the cashier.
                  </span>
                ) : (
                  <span className="mt-3 text-sm text-[#1f4d3a]/70">Tap for how it is billed</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
