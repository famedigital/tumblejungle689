"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/types";

export function PublicMenuShowcase({ menu }: { menu: MenuItem[] }) {
  const [activeCategory, setActiveCategory] = useState("all");

  const categories = ["all", ...new Set(menu.map((m) => m.category || "General"))];

  const filtered = menu.filter((item) => {
    if (!item.active) return false;
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Category Pills */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-2xl text-xs md:text-sm font-bold capitalize transition-all ${
              activeCategory === cat
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {filtered.slice(0, 16).map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {item.category}
              </span>
              <h4 className="font-extrabold text-sm md:text-base text-slate-900 dark:text-white line-clamp-1 mt-0.5">
                {item.name}
              </h4>
            </div>

            <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
              <span className="font-mono font-black text-sm md:text-base text-emerald-600 dark:text-emerald-400">
                Nu. {item.priceNu}
              </span>
              <span className="text-[10px] text-slate-600 dark:text-slate-300 capitalize font-medium">
                {item.outlet}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
