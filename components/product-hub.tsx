"use client";

import { useMemo, useState } from "react";
import { addCategoryAction, addMenuItemAction, saveExtraPerMinAction, saveRatesAction, updateMenuItemAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNu } from "@/lib/format";
import { extraCharge, playBasis } from "@/lib/overtime";
import type { MenuItem, Outlet, Rate } from "@/lib/types";

type Kind = "all" | "play" | "cafe" | "restaurant";

type Row = {
  desk: string;
  kind: Exclude<Kind, "all">;
  title: string;
  detail: string;
  price: string;
  off: boolean;
};

export function ProductHub({
  rates,
  extraPerMinNu,
  menu,
  categories,
  soldDishes,
  soldPlay,
  desk,
  ratesAreSamples,
  menuIsSample,
}: {
  rates: Rate[];
  extraPerMinNu: number;
  menu: MenuItem[];
  categories: { id: number; name: string; outlet: Outlet }[];
  soldDishes: Record<number, number>;
  soldPlay: Record<number, number>;
  desk?: string;
  ratesAreSamples: boolean;
  menuIsSample: boolean;
}) {
  const [kind, setKind] = useState<Kind>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(desk ?? "");

  const rows = useMemo(() => {
    const extra: Row[] = [
      {
        desk: "extra",
        kind: "play",
        title: "Extra time",
        detail: extraPerMinNu > 0 ? `Nu ${extraPerMinNu} a minute` : "From the 30 min price, by the minute",
        price: `${formatNu(extraCharge(1, rates, extraPerMinNu))} / min`,
        off: false,
      },
    ];
    const play: Row[] = rates.map((rate) => ({
      desk: `rate-${rate.minutes}`,
      kind: "play",
      title: `${rate.minutes} min play`,
      detail: "Play time",
      price: formatNu(rate.amountNu),
      off: false,
    }));
    const food: Row[] = menu.map((item) => ({
      desk: `item-${item.id}`,
      kind: item.outlet,
      title: item.name,
      detail: `${item.outlet === "cafe" ? "Cafe" : "Restaurant"} · ${item.category}`,
      price: formatNu(item.priceNu),
      off: !item.active,
    }));
    const needle = query.trim().toLowerCase();
    return [...extra, ...play, ...food].filter((row) => {
      if (kind !== "all" && row.kind !== kind) return false;
      if (!needle) return true;
      return `${row.title} ${row.detail}`.toLowerCase().includes(needle);
    });
  }, [rates, extraPerMinNu, menu, kind, query]);

  const rateIndex = rates.findIndex((rate) => `rate-${rate.minutes}` === open);
  const item = menu.find((row) => `item-${row.id}` === open);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10">
        <div className="space-y-3 border-b p-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a play time or dish"
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Find a product"
          />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Product kind">
            {(
              [
                ["all", "All"],
                ["play", "Play"],
                ["cafe", "Cafe"],
                ["restaurant", "Restaurant"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={kind === id}
                onClick={() => setKind(id)}
                className={`h-9 rounded-full px-3 text-sm ${kind === id ? "bg-primary text-primary-foreground" : "bg-[#fff3fb]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {ratesAreSamples || menuIsSample ? (
            <p className="text-sm text-muted-foreground">
              {ratesAreSamples ? "Play prices are samples. " : ""}
              {menuIsSample ? "Dishes are samples. " : ""}
              Saving here replaces them on the counters and the public page.
            </p>
          ) : null}
        </div>
        <ul className="max-h-[70vh] overflow-auto">
          {rows.length === 0 ? <li className="px-4 py-8 text-sm text-muted-foreground">Nothing matches.</li> : null}
          {rows.map((row) => {
            const selected = open === row.desk;
            return (
              <li key={row.desk}>
                <button
                  type="button"
                  onClick={() => setOpen(row.desk)}
                  aria-current={selected ? "true" : undefined}
                  className={`flex w-full items-center gap-3 border-b px-4 py-3 text-left ${selected ? "bg-[#ffe4f4]" : "hover:bg-[#fff7fb]"}`}
                >
                  <span className={`grid size-10 place-items-center rounded-2xl text-xs font-semibold ${badge(row.kind)}`}>
                    {row.kind === "play" ? "Play" : row.kind === "cafe" ? "Cafe" : "Food"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-medium ${row.off ? "text-muted-foreground line-through" : ""}`}>{row.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>
                  </span>
                  <span className="font-heading text-lg tabular-nums">{row.price}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24">
        {open === "extra" ? (
          <ExtraDesk key={extraPerMinNu} rates={rates} extraPerMinNu={extraPerMinNu} />
        ) : rateIndex >= 0 ? (
          <RateDesk key={rates[rateIndex].minutes} rates={rates} index={rateIndex} sold={soldPlay[rates[rateIndex].minutes] ?? 0} />
        ) : item ? (
          <ItemDesk key={item.id} item={item} categories={categories} sold={soldDishes[item.id] ?? 0} />
        ) : (
          <section className="space-y-2 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="font-heading text-2xl">New product</h2>
            <p className="text-sm text-muted-foreground">Pick a row to edit it, or add a play time, dish, or category.</p>
          </section>
        )}
        <NewPlay rates={rates} />
        <NewItem categories={categories} />
        <NewCategory />
      </aside>
    </div>
  );
}

function ExtraDesk({ rates, extraPerMinNu }: { rates: Rate[]; extraPerMinNu: number }) {
  const basis = playBasis(rates);
  const [value, setValue] = useState(extraPerMinNu > 0 ? String(extraPerMinNu) : "");
  const setNu = Math.max(0, Math.round(Number(value) || 0));
  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Extra time</p>
      <h2 className="font-heading text-2xl">Per minute</h2>
      <p className="text-sm text-muted-foreground">
        {basis
          ? `${basis.minutes} min is ${formatNu(basis.amountNu)}. Leave this blank to follow that price. Two extra minutes is ${formatNu(extraCharge(2, rates, 0))}.`
          : "Add a 30 minute play price first."}
      </p>
      <form action={saveExtraPerMinAction} className="grid gap-3">
        <input type="hidden" name="back" value="/admin/products" />
        <input type="hidden" name="amountNu" value={setNu} />
        <label className="space-y-1 text-sm">
          Nu per extra minute
          <Input
            inputMode="numeric"
            value={value}
            placeholder="Follow the 30 min price"
            onChange={(event) => setValue(event.target.value.replace(/\D/g, "").slice(0, 3))}
            className="h-11"
          />
        </label>
        <p className="text-sm text-muted-foreground">One extra minute is {formatNu(extraCharge(1, rates, setNu))}.</p>
        <Button type="submit" className="h-11">
          Save extra time
        </Button>
      </form>
    </section>
  );
}

function badge(kind: Row["kind"]) {
  if (kind === "play") return "bg-[#e4d4ff] text-[#4c1d95]";
  if (kind === "cafe") return "bg-[#d7fff3] text-[#064e43]";
  return "bg-[#fff3bf] text-[#5a3b00]";
}

function RateDesk({ rates, index, sold }: { rates: Rate[]; index: number; sold: number }) {
  const rate = rates[index];
  const [minutes, setMinutes] = useState(rate.minutes);
  const [amountNu, setAmountNu] = useState(rate.amountNu);
  const next = rates.map((row, i) => (i === index ? { minutes: Number(minutes), amountNu: Number(amountNu) } : row));
  const without = rates.filter((_, i) => i !== index);

  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Play time</p>
      <h2 className="font-heading text-2xl">{rate.minutes} minutes</h2>
      <p className="text-sm text-muted-foreground">{sold} sold today</p>
      <form action={saveRatesAction} className="grid gap-3">
        <input type="hidden" name="back" value="/admin/products" />
        <input type="hidden" name="desk" value={`rate-${minutes}`} />
        <input type="hidden" name="rates" value={JSON.stringify(next)} />
        <label className="space-y-1 text-sm">
          Minutes
          <Input type="number" min={30} max={120} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="h-11" />
        </label>
        <label className="space-y-1 text-sm">
          Nu
          <Input type="number" min={0} value={amountNu} onChange={(event) => setAmountNu(Number(event.target.value))} className="h-11" />
        </label>
        <Button type="submit" className="h-11">
          Save play time
        </Button>
      </form>
      <form action={saveRatesAction}>
        <input type="hidden" name="back" value="/admin/products" />
        <input type="hidden" name="rates" value={JSON.stringify(without)} />
        <Button type="submit" variant="ghost" className="h-11" disabled={without.length === 0}>
          Remove this play time
        </Button>
      </form>
    </section>
  );
}

function ItemDesk({
  item,
  categories,
  sold,
}: {
  item: MenuItem;
  categories: { id: number; name: string; outlet: Outlet }[];
  sold: number;
}) {
  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.outlet === "cafe" ? "Cafe" : "Restaurant"}</p>
      <h2 className="font-heading text-2xl">{item.name}</h2>
      <p className="text-sm text-muted-foreground">{sold} sold today</p>
      <form action={updateMenuItemAction} className="grid gap-3">
        <input type="hidden" name="back" value="/admin/products" />
        <input type="hidden" name="id" value={item.id} />
        <label className="space-y-1 text-sm">
          Name
          <Input name="name" defaultValue={item.name} className="h-11" required />
        </label>
        <label className="space-y-1 text-sm">
          Nu
          <Input name="priceNu" type="number" min={0} defaultValue={item.priceNu} className="h-11" required />
        </label>
        <label className="space-y-1 text-sm">
          Category
          <select name="categoryId" defaultValue={item.categoryId} className="h-11 w-full rounded-lg border bg-background px-2">
            {categories
              .filter((category) => category.outlet === item.outlet)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={item.active} />
          On the menu
        </label>
        <Button type="submit" className="h-11">
          Save dish
        </Button>
      </form>
    </section>
  );
}

function NewPlay({ rates }: { rates: Rate[] }) {
  const [minutes, setMinutes] = useState(60);
  const [amountNu, setAmountNu] = useState(0);
  const next = [...rates.filter((rate) => rate.minutes !== minutes), { minutes, amountNu }];

  return (
    <section className="space-y-3 rounded-3xl bg-[#f4e9ff] p-5">
      <h2 className="font-heading text-xl">Add play time</h2>
      <form action={saveRatesAction} className="grid gap-3">
        <input type="hidden" name="back" value="/admin/products" />
        <input type="hidden" name="desk" value={`rate-${minutes}`} />
        <input type="hidden" name="rates" value={JSON.stringify(next)} />
        <label className="space-y-1 text-sm">
          Minutes
          <Input type="number" min={30} max={120} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="h-11 bg-background" />
        </label>
        <label className="space-y-1 text-sm">
          Nu
          <Input type="number" min={0} value={amountNu} onChange={(event) => setAmountNu(Number(event.target.value))} className="h-11 bg-background" />
        </label>
        <Button type="submit" className="h-11">
          Add play time
        </Button>
      </form>
    </section>
  );
}

function NewItem({ categories }: { categories: { id: number; name: string; outlet: Outlet }[] }) {
  return (
    <section className="space-y-3 rounded-3xl bg-[#d7fff3] p-5">
      <h2 className="font-heading text-xl">Add dish</h2>
      <form action={addMenuItemAction} className="grid gap-3">
        <input type="hidden" name="back" value="/admin/products" />
        <label className="space-y-1 text-sm">
          Category
          <select name="categoryId" className="h-11 w-full rounded-lg border bg-background px-2" required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.outlet === "cafe" ? "Cafe" : "Restaurant"} · {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Name
          <Input name="name" className="h-11 bg-background" required />
        </label>
        <label className="space-y-1 text-sm">
          Nu
          <Input name="priceNu" type="number" min={0} className="h-11 bg-background" required />
        </label>
        <Button type="submit" className="h-11">
          Add dish
        </Button>
      </form>
    </section>
  );
}

function NewCategory() {
  return (
    <section className="space-y-3 rounded-3xl bg-[#fff3bf] p-5">
      <h2 className="font-heading text-xl">Add category</h2>
      <form action={addCategoryAction} className="grid gap-3">
        <input type="hidden" name="back" value="/admin/products" />
        <label className="space-y-1 text-sm">
          Name
          <Input name="name" className="h-11 bg-background" required />
        </label>
        <label className="space-y-1 text-sm">
          Counter
          <select name="outlet" className="h-11 w-full rounded-lg border bg-background px-2">
            <option value="cafe">Cafe</option>
            <option value="restaurant">Restaurant</option>
          </select>
        </label>
        <Button type="submit" variant="outline" className="h-11 bg-background">
          Add category
        </Button>
      </form>
    </section>
  );
}
