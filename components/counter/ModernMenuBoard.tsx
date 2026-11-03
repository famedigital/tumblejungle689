"use client";

import { useMemo, useState } from "react";
import { Flame, Plus, ShoppingBag } from "lucide-react";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { GlassTabs } from "@/components/ui/glass/GlassTabs";
import { formatNu } from "@/lib/format";
import type { Outlet } from "@/lib/types";
import { cn } from "@/lib/utils";

export type MenuBoardItem = {
  id: number | string;
  name: string;
  priceNu: number;
  category: string;
  outlet: Outlet;
};

export type CartLine = {
  name: string;
  qty: number;
  amountNu: number;
};

export interface ModernMenuBoardProps {
  items: MenuBoardItem[];
  outlet: Outlet;
  onAdd: (item: MenuBoardItem) => void;
  cart: CartLine[];
  onFire?: () => void;
}

export function ModernMenuBoard({ items, outlet, onAdd, cart, onFire }: ModernMenuBoardProps) {
  const scoped = useMemo(() => items.filter((item) => item.outlet === outlet), [items, outlet]);
  const categories = useMemo(() => {
    const set = new Set(scoped.map((i) => i.category || "Menu"));
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [scoped]);

  const [category, setCategory] = useState("All");

  const visible = useMemo(() => {
    if (category === "All") return scoped;
    return scoped.filter((i) => (i.category || "Menu") === category);
  }, [category, scoped]);

  const cartTotal = cart.reduce((sum, line) => sum + line.amountNu, 0);
  const cartQty = cart.reduce((sum, line) => sum + line.qty, 0);

  const tabs = categories.map((cat) => ({
    id: cat,
    label: cat,
    badge: cat === "All" ? scoped.length : scoped.filter((i) => (i.category || "Menu") === cat).length,
  }));

  return (
    <div className="grid min-h-[60vh] gap-4 lg:grid-cols-[1fr_minmax(280px,360px)]">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold capitalize text-slate-900 dark:text-white">
              {outlet === "cafe" ? "Cafe & bar" : "Restaurant"} menu
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Tap items to add to the open ticket</p>
          </div>
          <GlassTabs tabs={tabs} activeId={category} onChange={setCategory} className="max-w-full overflow-x-auto" />
        </header>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <li key={String(item.id)}>
              <GlassCard
                interactive
                padding="md"
                className="flex h-full min-h-[7rem] flex-col justify-between"
                onClick={() => onAdd(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAdd(item);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <p className="line-clamp-2 font-bold text-slate-900 dark:text-white">{item.name}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-lg font-bold text-teal-700 dark:text-teal-300">{formatNu(item.priceNu)}</span>
                  <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <Plus className="size-5" aria-hidden />
                  </span>
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>

        {visible.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No items in this category.</p>
        ) : null}
      </div>

      <GlassCard padding="lg" variant="elevated" className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-slate-600 dark:text-slate-300" aria-hidden />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Order tab</h2>
          {cartQty > 0 ? (
            <span className="ml-auto rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">{cartQty}</span>
          ) : null}
        </div>

        {cart.length === 0 ? (
          <p className="flex-1 text-sm text-slate-500 dark:text-slate-400">Tap menu cards to build the ticket.</p>
        ) : (
          <ul className="max-h-[50vh] flex-1 space-y-2 overflow-y-auto">
            {cart.map((line, idx) => (
              <li
                key={`${line.name}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-slate-900/50"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {line.qty}× {line.name}
                </span>
                <span className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">{formatNu(line.amountNu)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-slate-200/80 pt-3 dark:border-white/10">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">Subtotal</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatNu(cartTotal)}</span>
          </div>
          {onFire && outlet === "restaurant" ? (
            <GlassButton
              type="button"
              variant="amber"
              size="lg"
              className="w-full"
              disabled={cart.length === 0}
              onClick={onFire}
            >
              <Flame className="size-5" />
              Fire kitchen (KOT)
            </GlassButton>
          ) : (
            <p className={cn("text-center text-xs text-slate-500 dark:text-slate-400", cart.length > 0 && "hidden")}>
              {outlet === "cafe" ? "Items stay on the visit tab until checkout." : "Add dishes, then fire KOT."}
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
