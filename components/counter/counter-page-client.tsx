"use client";

import { useMemo, useState } from "react";
import { ModernMenuBoard } from "@/components/counter/ModernMenuBoard";
import { KotLivePipeline } from "@/components/kitchen/KotLivePipeline";
import { EnterpriseShell } from "@/components/shell/EnterpriseShell";
import { GlassTabs } from "@/components/ui/glass";
import type { MenuItem, Outlet } from "@/lib/types";

type CartLine = { name: string; qty: number; amountNu: number; unitNu: number };
type Ticket = {
  id: string;
  code: string;
  tableNo: string;
  lines: { name: string; qty: number }[];
  status: "fired" | "prep" | "ready" | "delivered";
  firedAt: string;
};

export function CounterPageClient({
  outlet,
  menu,
  venueName,
}: {
  outlet: Outlet;
  menu: MenuItem[];
  venueName: string;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tab, setTab] = useState("menu");
  const label = outlet === "cafe" ? "Cafe & Bar" : "Restaurant";

  const boardItems = useMemo(
    () =>
      menu.map((item) => ({
        id: item.id,
        name: item.name,
        priceNu: item.priceNu,
        category: item.category,
        outlet: item.outlet,
      })),
    [menu],
  );

  function addItem(item: { id: number | string; name: string; priceNu: number; category: string; outlet: Outlet }) {
    setCart((current) => {
      const hit = current.find((row) => row.name === item.name);
      if (hit) {
        return current.map((row) =>
          row.name === item.name
            ? { ...row, qty: row.qty + 1, amountNu: (row.qty + 1) * row.unitNu }
            : row,
        );
      }
      return [...current, { name: item.name, qty: 1, unitNu: item.priceNu, amountNu: item.priceNu }];
    });
  }

  function fireKot() {
    if (!cart.length) return;
    const id = crypto.randomUUID();
    setTickets((current) => [
      {
        id,
        code: id.slice(0, 4).toUpperCase(),
        tableNo: outlet === "restaurant" ? "Standing" : "Counter",
        lines: cart.map((row) => ({ name: row.name, qty: row.qty })),
        status: "fired",
        firedAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setCart([]);
    setTab("kitchen");
  }

  return (
    <EnterpriseShell outletLabel={label}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl text-slate-900 dark:text-white">{venueName}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{label} order board</p>
        </div>
        <GlassTabs
          tabs={[
            { id: "menu", label: "Menu" },
            { id: "kitchen", label: "KOT", badge: tickets.filter((t) => t.status !== "delivered").length || undefined },
          ]}
          activeId={tab}
          onChange={setTab}
        />
      </div>
      {tab === "menu" ? (
        <ModernMenuBoard
          items={boardItems}
          outlet={outlet}
          cart={cart}
          onAdd={addItem}
          onFire={fireKot}
        />
      ) : (
        <KotLivePipeline
          tickets={tickets}
          onBump={(id, next) => {
            setTickets((current) => current.map((ticket) => (ticket.id === id ? { ...ticket, status: next } : ticket)));
          }}
        />
      )}
    </EnterpriseShell>
  );
}
