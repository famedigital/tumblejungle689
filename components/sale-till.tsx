"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addItemAction, logoutAction, payOutletAction, qtyAction } from "@/app/actions";
import { HoldSheet } from "@/components/hold-sheet";
import { Scanner } from "@/components/scanner";
import { TenderSheet, type TenderMethod } from "@/components/tender-sheet";
import { TillShell } from "@/components/till-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatNu, formatPhone, formatWhen, minutesLeft } from "@/lib/format";
import { submitOpenTender, useTillHotkeys } from "@/lib/hotkeys";
import { buildDynamicEmv } from "@/lib/emv";
import { polePost, type PoleLine } from "@/lib/pole";
import type { MenuItem, Outlet, VisitView } from "@/lib/types";

export function SaleTill({
  staffName,
  staffRole,
  title,
  back,
  outlet,
  menu = [],
  staticPayload,
  visit,
  open,
  error,
  ok,
  query,
  journalScan = false,
}: {
  staffName: string;
  staffRole: string;
  title: string;
  back: string;
  outlet: Outlet;
  menu?: MenuItem[];
  staticPayload: string;
  visit: VisitView | null;
  open: VisitView[];
  error?: string;
  ok?: string;
  query?: string;
  journalScan?: boolean;
}) {
  const [cam, setCam] = useState(false);
  const [method, setMethod] = useState<TenderMethod>("bank_qr");
  const [lineId, setLineId] = useState<number | null>(null);
  const [holdsOpen, setHoldsOpen] = useState(false);
  const [dishQuery, setDishQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [tenderOpen, setTenderOpen] = useState(false);
  const [scanNu, setScanNu] = useState(0);
  const menuFind = useRef<HTMLInputElement>(null);
  const openVisit = visit?.status === "open" ? visit : null;
  const due =
    visit?.lines.filter((line) => line.outlet === outlet && !line.paid).reduce((sum, line) => sum + line.amountNu, 0) ?? 0;
  const left = visit ? minutesLeft(visit.paidUntil) : null;
  const selected = visit?.lines.find((line) => line.id === lineId && !line.paid) ?? null;
  const status =
    error ||
    ok ||
    (visit
      ? `${visit.guardianName ? `${visit.guardianName} · ` : ""}${formatPhone(visit.phone)}${visit.status === "settled" ? " · closed" : ""}`
      : "Scan a play ticket, or press Alt+H for guests on hold.");
  const needle = dishQuery.trim().toLowerCase();
  const dishes = useMemo(
    () => menu.filter((item) => !needle || `${item.name} ${item.category}`.toLowerCase().includes(needle)),
    [menu, needle],
  );
  const categories = [...new Set(dishes.map((item) => item.category))];
  const ownLines = visit?.lines.filter((line) => line.outlet === outlet) ?? [];
  const otherDue =
    visit?.lines.filter((line) => line.outlet !== outlet && !line.paid).reduce((sum, line) => sum + line.amountNu, 0) ?? 0;

  useEffect(() => {
    if (!holdsOpen) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [holdsOpen]);

  useTillHotkeys((letter) => {
    if (letter === "h") {
      setHoldsOpen((openSheet) => !openSheet);
      return;
    }
    if (letter === "l") {
      setHoldsOpen(false);
      menuFind.current?.focus();
      menuFind.current?.select();
      return;
    }
    if (letter === "s") {
      if (tenderOpen) submitOpenTender();
      else if (openVisit && due > 0) setTenderOpen(true);
    }
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.type !== "keydown" || event.repeat) return;
      if (event.key === "Escape") {
        setHoldsOpen(false);
        setTenderOpen(false);
      }
      if (event.key === "F10" && openVisit && due > 0) {
        event.preventDefault();
        setTenderOpen(true);
      }
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, [openVisit, due]);

  const billKey = ownLines.map((line) => `${line.id}:${line.qty}:${line.amountNu}:${line.paid}`).join("|");

  useEffect(() => {
    const bankNu = method === "cash" ? 0 : method === "split" ? scanNu : due;
    const showQr = tenderOpen && bankNu > 0;
    const lines: PoleLine[] = ownLines.map((line) => ({
      name: line.name,
      qty: line.qty,
      amount: line.amountNu,
      paid: line.paid,
    }));
    polePost({
      shop: title,
      code: visit?.code ?? "",
      phone: visit ? formatPhone(visit.phone) : "",
      lines,
      due,
      payNu: showQr ? bankNu : 0,
      qr: showQr ? buildDynamicEmv(staticPayload, bankNu, visit ? `${title} ${visit.code}` : title) : "",
      extra: otherDue > 0 ? `Other counters still have ${formatNu(otherDue)} open.` : "",
      thanks: false,
    });
    // billKey tracks line edits without putting a fresh array in the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderOpen, method, scanNu, due, billKey, otherDue, staticPayload, title, visit]);

  return (
    <TillShell
      touch="cashier"
      scanAction={back}
      scanDefault={query}
      dueEyebrow="Due here"
      dueValue={formatNu(due)}
      dueHint={visit ? (left != null && left < 0 && visit.status === "open" ? "Overtime" : `${ownLines.length} on this bill`) : "Waiting for a ticket"}
      status={status}
      statusBad={Boolean(error)}
      tools={
        <>
          {open.slice(0, 6).map((item) => (
            <Button key={item.id} variant={visit?.code === item.code ? "default" : "outline"} className="h-11" asChild>
              <Link href={`${back}?q=${item.code}`}>{formatPhone(item.phone)}</Link>
            </Button>
          ))}
          <Button type="button" variant={holdsOpen ? "secondary" : "outline"} className="h-11" onClick={() => setHoldsOpen(true)}>
            Guests
          </Button>
          <Button type="button" variant={cam ? "secondary" : "outline"} className="h-11" aria-pressed={cam} onClick={() => setCam((value) => !value)}>
            Camera
          </Button>
          <Button type="button" className="h-11" disabled={!openVisit || due <= 0} onClick={() => setTenderOpen(true)}>
            Tender
            <span className="ml-1 text-[10px] tracking-wide uppercase opacity-80">Alt+S</span>
          </Button>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="h-11">
              Lock
            </Button>
          </form>
          {staffRole === "admin" ? (
            <Button variant="outline" className="h-11" asChild>
              <Link href="/admin">Office</Link>
            </Button>
          ) : null}
        </>
      }
    >
      <p className="sr-only">
        {title} · {staffName}
      </p>
      {cam ? (
        <div className="border-b border-border bg-card px-3 py-2">
          <Scanner to={back} defaultOpen />
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-h-0 overflow-auto p-3" aria-label="Menu">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-heading text-2xl">Menu</h2>
            <label className="min-w-48 flex-1">
              <span className="sr-only">Find a dish</span>
              <Input
                ref={menuFind}
                value={dishQuery}
                onChange={(event) => setDishQuery(event.target.value)}
                placeholder="Search dishes"
                aria-label="Find a dish"
                className="h-12 text-base"
              />
            </label>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{menu.length === 0 ? "No dishes on this counter yet." : "No dish matches that search."}</p>
          ) : (
            categories.map((category) => (
              <div key={category} className="mb-4">
                <h3 className="mb-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{category}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {dishes
                    .filter((item) => item.category === category)
                    .map((item) =>
                      openVisit ? (
                        <form key={item.id} action={addItemAction}>
                          <input type="hidden" name="visitId" value={openVisit.id} />
                          <input type="hidden" name="code" value={openVisit.code} />
                          <input type="hidden" name="outlet" value={outlet} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <Button type="submit" variant="outline" className="h-auto min-h-16 w-full flex-col items-start px-3 py-2 text-left">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-muted-foreground">{formatNu(item.priceNu)}</span>
                          </Button>
                        </form>
                      ) : (
                        <Button key={item.id} type="button" variant="outline" className="h-auto min-h-16 w-full flex-col items-start px-3 py-2" disabled>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground">{formatNu(item.priceNu)}</span>
                        </Button>
                      ),
                    )}
                </div>
              </div>
            ))
          )}
        </section>
        <Card className="m-3 flex min-h-0 flex-col gap-3 p-4">
          <div>
            <p className="font-medium">{visit ? formatPhone(visit.phone) : "No guest"}</p>
            <p className="text-sm text-muted-foreground">
              {visit
                ? left == null
                  ? "No play time"
                  : left < 0
                    ? `${Math.abs(left)} min over`
                    : `${left} min left · until ${formatWhen(visit.paidUntil)}`
                : "Scan a ticket to start an order"}
            </p>
            {visit?.guardianName ? <Badge className="mt-2">{visit.guardianName}</Badge> : null}
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
            {ownLines.length === 0 ? (
              <li className="text-sm text-muted-foreground">This bill is empty.</li>
            ) : (
              ownLines.map((line) => (
                <li key={line.id}>
                  <button
                    type="button"
                    disabled={line.paid}
                    aria-pressed={selected?.id === line.id}
                    onClick={() => setLineId(line.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left ${selected?.id === line.id ? "bg-secondary" : "hover:bg-muted"}`}
                  >
                    <span>
                      {line.name}
                      <small className="mt-0.5 block text-muted-foreground">
                        × {line.qty}
                        {line.paid ? " · paid" : ""}
                      </small>
                    </span>
                    <span className="tabular-nums">{formatNu(line.amountNu)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {otherDue > 0 ? <p className="text-sm">Other counters still have {formatNu(otherDue)} open. This tender does not close the visit.</p> : null}
          <div className="grid grid-cols-3 gap-2">
            <Qty visit={openVisit} outlet={outlet} line={selected} delta={-1} label="Less" back={back} />
            <Qty visit={openVisit} outlet={outlet} line={selected} delta={1} label="More" back={back} />
            <Button type="button" variant="outline" className="h-12" onClick={() => setCam(true)}>
              Scan
            </Button>
          </div>
        </Card>
      </div>
      {tenderOpen && openVisit && due > 0 ? (
        <TenderSheet
          action={payOutletAction}
          method={method}
          onMethod={setMethod}
          onScan={setScanNu}
          amountNu={due}
          staticPayload={staticPayload}
          note={`${title} ${openVisit.code}`}
          journalScan={journalScan}
          customer={{ name: openVisit.guardianName, phone: openVisit.phone, children: openVisit.childCount }}
          onClose={() => setTenderOpen(false)}
        >
          <input type="hidden" name="visitId" value={openVisit.id} />
          <input type="hidden" name="code" value={openVisit.code} />
          <input type="hidden" name="outlet" value={outlet} />
        </TenderSheet>
      ) : null}
      {holdsOpen ? <HoldSheet visits={open} now={now} currentId={openVisit?.id} desk={back} onClose={() => setHoldsOpen(false)} /> : null}
    </TillShell>
  );
}

function Qty({
  visit,
  outlet,
  line,
  delta,
  label,
  back,
}: {
  visit: VisitView | null;
  outlet: Outlet;
  line: { id: number } | null;
  delta: number;
  label: string;
  back: string;
}) {
  if (!visit || !line) {
    return (
      <Button type="button" variant="outline" className="h-12" disabled>
        {label}
      </Button>
    );
  }
  return (
    <form action={qtyAction}>
      <input type="hidden" name="lineId" value={line.id} />
      <input type="hidden" name="code" value={visit.code} />
      <input type="hidden" name="outlet" value={outlet} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="delta" value={delta} />
      <Button type="submit" variant="outline" className="h-12 w-full">
        {label}
      </Button>
    </form>
  );
}
