"use client";

import { useMemo, useState } from "react";
import {
  adjustStockAction,
  enableStockTrackingAction,
  receivePurchaseAction,
  updateMenuItemAction,
} from "@/app/actions";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { Input } from "@/components/ui/input";
import { formatNu, formatWhen } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

type StockRow = MenuItem & { soldToday: number; low: boolean };

type PurchaseDraftLine = { itemId: number; qty: string; unitCostNu: string };

export function StockHub({
  tracked,
  catalog,
  purchases,
}: {
  tracked: StockRow[];
  catalog: MenuItem[];
  purchases: { id: number; supplierName: string; totalNu: number; note: string; createdAt: string; lineCount: number }[];
}) {
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<"list" | "receive" | "adjust" | "enable">("list");
  const [adjustId, setAdjustId] = useState(tracked[0]?.id ?? 0);
  const untracked = useMemo(
    () => catalog.filter((item) => !item.trackStock && item.active),
    [catalog],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tracked.filter((item) => {
      if (!needle) return true;
      return `${item.name} ${item.category} ${item.outlet}`.toLowerCase().includes(needle);
    });
  }, [tracked, query]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <GlassCard padding="none" className="overflow-hidden">
        <div className="space-y-3 border-b border-slate-200/70 p-4 dark:border-white/10">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Ready-made stock only — bottled drinks, chips, canned tea. Cooking dishes stay untracked.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a stocked item"
              className="h-11 min-w-[12rem] flex-1"
              aria-label="Find stock item"
            />
            <GlassButton type="button" onClick={() => setPanel("receive")}>
              Receive
            </GlassButton>
            <GlassButton type="button" variant="slate" onClick={() => setPanel("adjust")}>
              Adjust
            </GlassButton>
            <GlassButton type="button" variant="ghost" onClick={() => setPanel("enable")}>
              Track item
            </GlassButton>
          </div>
        </div>
        <ul className="max-h-[70vh] divide-y divide-slate-200/70 overflow-auto dark:divide-white/10">
          {rows.length === 0 ? (
            <li className="px-4 py-8 text-sm text-slate-700 dark:text-slate-300">
              No tracked items yet. Receive a purchase or turn tracking on for mineral water, cola, chips…
            </li>
          ) : null}
          {rows.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{item.name}</p>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {item.outlet === "cafe" ? "Cafe" : "Kitchen"} · {item.category} · sold {item.soldToday} today
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-heading text-xl tabular-nums text-slate-900 dark:text-white">{item.stockQty}</p>
                <div className="mt-1 flex flex-wrap justify-end gap-1">
                  {item.low ? <GlassBadge tone="warning">Reorder</GlassBadge> : <GlassBadge tone="active">OK</GlassBadge>}
                  <GlassBadge tone="neutral">{formatNu(item.costNu)} cost</GlassBadge>
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-emerald-700 underline dark:text-emerald-300"
                  onClick={() => {
                    setAdjustId(item.id);
                    setPanel("adjust");
                  }}
                >
                  Adjust
                </button>
              </div>
            </li>
          ))}
        </ul>
      </GlassCard>

      <div className="grid gap-4">
        {panel === "receive" ? <ReceivePanel catalog={catalog} onClose={() => setPanel("list")} /> : null}
        {panel === "adjust" ? (
          <AdjustPanel items={tracked} itemId={adjustId} onPick={setAdjustId} onClose={() => setPanel("list")} />
        ) : null}
        {panel === "enable" ? <EnablePanel items={untracked} onClose={() => setPanel("list")} /> : null}
        {panel === "list" ? (
          <GlassCard>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-300">Recent purchases</p>
            <ul className="mt-3 space-y-2">
              {purchases.length === 0 ? (
                <li className="text-sm text-slate-700 dark:text-slate-300">No purchases yet.</li>
              ) : (
                purchases.map((row) => (
                  <li key={row.id} className="rounded-xl border border-slate-200/70 px-3 py-2 dark:border-white/10">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      PO-{row.id} · {row.supplierName}
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {row.lineCount} lines · {formatNu(row.totalNu)} · {formatWhen(row.createdAt)}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </GlassCard>
        ) : null}
      </div>
    </div>
  );
}

function ReceivePanel({ catalog, onClose }: { catalog: MenuItem[]; onClose: () => void }) {
  const stockable = catalog.filter((item) => item.active);
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<PurchaseDraftLine[]>([
    { itemId: stockable[0]?.id ?? 0, qty: "12", unitCostNu: "20" },
  ]);

  const payload = lines
    .map((line) => ({
      itemId: Number(line.itemId),
      qty: Number(line.qty),
      unitCostNu: Number(line.unitCostNu),
    }))
    .filter((line) => line.itemId > 0 && line.qty > 0);

  return (
    <GlassCard>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-heading text-xl text-slate-900 dark:text-white">Receive purchase</h2>
        <GlassButton type="button" variant="ghost" onClick={onClose}>
          Close
        </GlassButton>
      </div>
      <form action={receivePurchaseAction} className="grid gap-3">
        <input type="hidden" name="linesJson" value={JSON.stringify(payload)} />
        <label className="space-y-1 text-sm text-slate-900 dark:text-white">
          Supplier
          <Input name="supplierName" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="h-11" required />
        </label>
        <label className="space-y-1 text-sm text-slate-900 dark:text-white">
          Note
          <Input name="note" value={note} onChange={(e) => setNote(e.target.value)} className="h-11" placeholder="Optional" />
        </label>
        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-slate-200/70 p-2 dark:border-white/10">
              <select
                className="h-11 w-full rounded-lg border bg-background px-2"
                value={line.itemId}
                onChange={(event) => {
                  const next = [...lines];
                  next[index] = { ...line, itemId: Number(event.target.value) };
                  setLines(next);
                }}
              >
                {stockable.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.outlet === "cafe" ? "Cafe" : "Kitchen"})
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  inputMode="numeric"
                  value={line.qty}
                  onChange={(event) => {
                    const next = [...lines];
                    next[index] = { ...line, qty: event.target.value.replace(/\D/g, "").slice(0, 5) };
                    setLines(next);
                  }}
                  placeholder="Qty"
                  className="h-11"
                  aria-label="Quantity"
                />
                <Input
                  inputMode="numeric"
                  value={line.unitCostNu}
                  onChange={(event) => {
                    const next = [...lines];
                    next[index] = { ...line, unitCostNu: event.target.value.replace(/\D/g, "").slice(0, 6) };
                    setLines(next);
                  }}
                  placeholder="Cost Nu"
                  className="h-11"
                  aria-label="Unit cost"
                />
              </div>
            </div>
          ))}
        </div>
        <GlassButton
          type="button"
          variant="slate"
          onClick={() => setLines([...lines, { itemId: stockable[0]?.id ?? 0, qty: "1", unitCostNu: "0" }])}
        >
          Add line
        </GlassButton>
        <GlassButton type="submit" disabled={!payload.length || !supplierName.trim()}>
          Receive into stock
        </GlassButton>
      </form>
    </GlassCard>
  );
}

function AdjustPanel({
  items,
  itemId,
  onPick,
  onClose,
}: {
  items: StockRow[];
  itemId: number;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const current = items.find((item) => item.id === itemId) ?? items[0];
  if (!current) {
    return (
      <GlassCard>
        <p className="text-sm text-slate-700 dark:text-slate-300">Track an item first.</p>
        <GlassButton type="button" className="mt-3" variant="ghost" onClick={onClose}>
          Close
        </GlassButton>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-heading text-xl text-slate-900 dark:text-white">Adjust stock</h2>
        <GlassButton type="button" variant="ghost" onClick={onClose}>
          Close
        </GlassButton>
      </div>
      <form action={adjustStockAction} className="grid gap-3">
        <input type="hidden" name="itemId" value={current.id} />
        <label className="space-y-1 text-sm text-slate-900 dark:text-white">
          Item
          <select
            className="h-11 w-full rounded-lg border bg-background px-2"
            value={current.id}
            onChange={(event) => onPick(Number(event.target.value))}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · on hand {item.stockQty}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-slate-900 dark:text-white">
          Change (+ add / − remove)
          <Input name="delta" type="number" className="h-11" required />
        </label>
        <label className="space-y-1 text-sm text-slate-900 dark:text-white">
          Reason
          <Input name="note" className="h-11" placeholder="Count, breakage…" />
        </label>
        <GlassButton type="submit">Save adjust</GlassButton>
      </form>
      <form action={updateMenuItemAction} className="mt-4 grid gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10">
        <input type="hidden" name="back" value="/admin/stock" />
        <input type="hidden" name="id" value={current.id} />
        <input type="hidden" name="name" value={current.name} />
        <input type="hidden" name="priceNu" value={current.priceNu} />
        <input type="hidden" name="categoryId" value={current.categoryId} />
        <input type="hidden" name="active" value="on" />
        <input type="hidden" name="stockFields" value="1" />
        <input type="hidden" name="trackStock" value="on" />
        <label className="space-y-1 text-sm text-slate-900 dark:text-white">
          Reorder at
          <Input name="reorderQty" type="number" min={0} defaultValue={current.reorderQty} className="h-11" />
        </label>
        <GlassButton type="submit" variant="slate">
          Save reorder level
        </GlassButton>
      </form>
    </GlassCard>
  );
}

function EnablePanel({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <GlassCard>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-heading text-xl text-slate-900 dark:text-white">Track ready-made</h2>
        <GlassButton type="button" variant="ghost" onClick={onClose}>
          Close
        </GlassButton>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-700 dark:text-slate-300">Every active dish is already tracked, or add one under Products.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 px-3 py-2 dark:border-white/10">
              <span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">{item.name}</span>
              <form action={enableStockTrackingAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="reorderQty" value={5} />
                <GlassButton type="submit" className="h-9 px-3 text-xs">
                  Track
                </GlassButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
