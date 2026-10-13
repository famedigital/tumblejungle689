"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addPlayAction, cancelHoldAction, checkInAction, logoutAction, payPlayAction, removeLineAction, removePlayAction } from "@/app/actions";
import { PassCard } from "@/components/pass-card";
import { Scanner } from "@/components/scanner";
import { TenderSheet, type TenderMethod } from "@/components/tender-sheet";
import { TillShell } from "@/components/till-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatNu, formatPhone, formatWhen, minutesLeft } from "@/lib/format";
import { submitOpenTender, useTillHotkeys } from "@/lib/hotkeys";
import { buildDynamicEmv } from "@/lib/emv";
import { isPoleHello, polePost, POLE_CHANNEL, type PolePayload } from "@/lib/pole";
import type { Rate, VisitView } from "@/lib/types";

export function DeskTill({
  staffName,
  staffRole,
  rates,
  staticPayload,
  visit,
  open,
  error,
  ok,
  issued,
  qr,
  ticketUrl,
  venueName,
  query,
  journalScan = false,
}: {
  staffName: string;
  staffRole: string;
  rates: Rate[];
  staticPayload: string;
  visit: VisitView | null;
  open: VisitView[];
  error?: string;
  ok?: string;
  issued: VisitView | null;
  qr: string;
  ticketUrl: string;
  venueName: string;
  query?: string;
  journalScan?: boolean;
}) {
  const [phone, setPhone] = useState(query ?? "");
  const [name, setName] = useState("");
  const [children, setChildren] = useState(1);
  const [minutes, setMinutes] = useState(rates[0]?.minutes ?? 60);
  const [cam, setCam] = useState(false);
  const [showPass, setShowPass] = useState(Boolean(issued));
  const [tenderOpen, setTenderOpen] = useState(false);
  const [method, setMethod] = useState<TenderMethod>("bank_qr");
  const [scanNu, setScanNu] = useState(0);
  const rate = rates.find((item) => item.minutes === minutes) ?? rates[0];
  const playDue = visit?.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0) ?? 0;
  const openVisit = visit?.status === "open" ? visit : null;
  const due = openVisit ? openVisit.dueNu : visit ? 0 : rate?.amountNu ?? 0;
  const tenderAmount = openVisit ? playDue : rate?.amountNu ?? 0;
  const left = visit ? minutesLeft(visit.paidUntil) : null;
  const pass = issued ?? (showPass ? visit : null);
  const status =
    error ||
    ok ||
    (visit
      ? `${visit.code} · ${formatPhone(visit.phone)}${visit.status === "settled" ? " · closed" : ""}`
      : "Scan a phone or pick play time, then Tender");
  const canTender = Boolean(openVisit ? playDue > 0 : rate && phone.replace(/\D/g, "").length === 8);

  useTillHotkeys((letter) => {
    if (letter !== "s") return;
    if (tenderOpen) submitOpenTender();
    else if (canTender) setTenderOpen(true);
  });
  const poleRef = useRef<PolePayload | null>(null);

  useEffect(() => {
    const bankNu = method === "cash" ? 0 : method === "split" ? scanNu : tenderAmount;
    const showQr = tenderOpen && bankNu > 0;
    const payload: PolePayload = {
      shop: venueName,
      code: openVisit?.code ?? "",
      phone: openVisit ? formatPhone(openVisit.phone) : formatPhone(phone),
      lines: openVisit
        ? openVisit.blocks.map((block) => ({
            name: `Play ${block.minutes} min`,
            qty: 1,
            amount: block.amountNu,
            paid: block.paid,
          }))
        : [{ name: `Play ${minutes} min`, qty: 1, amount: tenderAmount, paid: false }],
      due: tenderAmount,
      payNu: showQr ? bankNu : 0,
      qr: showQr ? buildDynamicEmv(staticPayload, bankNu, openVisit ? openVisit.code : `Play ${minutes}m`) : "",
      extra: "",
      thanks: false,
    };
    poleRef.current = payload;
    polePost(payload);
  }, [tenderOpen, method, scanNu, tenderAmount, openVisit, venueName, staticPayload, minutes, phone]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(POLE_CHANNEL);
    channel.onmessage = (event) => {
      if (isPoleHello(event.data) && poleRef.current) polePost(poleRef.current);
    };
    return () => channel.close();
  }, []);

  return (
    <TillShell
      scanAction="/desk"
      scanValue={phone}
      onScanChange={setPhone}
      dueEyebrow="Due"
      dueValue={formatNu(due)}
      dueHint={visit ? (visit.status === "settled" ? "Closed" : left != null && left < 0 ? "Overtime" : "Open visit") : "New play"}
      status={status}
      statusBad={Boolean(error)}
      tools={
        <>
          {open.slice(0, 6).map((item) => (
            <Button key={item.id} variant={visit?.code === item.code ? "default" : "outline"} className="h-11" asChild>
              <Link href={`/desk?q=${item.code}`}>{item.code}</Link>
            </Button>
          ))}
          <Button type="button" variant="outline" className="h-11" onClick={() => setShowPass(true)} disabled={!visit && !issued}>
            Ticket
          </Button>
          <Button type="button" variant={cam ? "secondary" : "outline"} className="h-11" aria-pressed={cam} onClick={() => setCam((openCam) => !openCam)}>
            Camera
          </Button>
          <Button type="button" className="h-11" disabled={!canTender} onClick={() => setTenderOpen(true)}>
            Tender
            <span className="ml-1 text-[10px] tracking-wide uppercase opacity-80">Alt+S</span>
          </Button>
        </>
      }
      footer={
        <>
          {rates.map((item) => (
            <PlayKey key={item.minutes} minutes={item.minutes} visit={openVisit} pressed={minutes === item.minutes} onPick={() => setMinutes(item.minutes)} />
          ))}
          {openVisit && playDue > 0 ? (
            <form action={removePlayAction}>
              <input type="hidden" name="visitId" value={openVisit.id} />
              <input type="hidden" name="code" value={openVisit.code} />
              <input type="hidden" name="back" value="/desk" />
              <Button type="submit" variant="outline" className="h-12 w-full">
                Unpaid play
              </Button>
            </form>
          ) : (
            <Button type="button" variant="outline" className="h-12" disabled>
              {venueName}
            </Button>
          )}
        </>
      }
    >
      {cam ? (
        <div className="border-b border-border bg-card px-3 py-2">
          <Scanner to="/desk" defaultOpen />
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-h-0 overflow-auto p-3">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="py-2">Item</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {visit ? (
                <>
                  {visit.blocks.map((block) => (
                    <tr key={block.id} className="border-t border-border">
                      <td className="py-3">Play {block.minutes} min</td>
                      <td className="tabular-nums">1</td>
                      <td className="tabular-nums">{formatNu(block.amountNu)}</td>
                      <td>
                        {block.paid ? "Paid" : "Due"}
                        {!block.paid && visit.blocks[visit.blocks.length - 1]?.id === block.id ? (
                          <form action={removePlayAction}>
                            <input type="hidden" name="visitId" value={visit.id} />
                            <input type="hidden" name="code" value={visit.code} />
                            <input type="hidden" name="back" value="/desk" />
                            <Button type="submit" variant="ghost" size="sm">
                              Delete
                            </Button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {visit.lines.map((line) => (
                    <tr key={line.id} className="border-t border-border">
                      <td className="py-3">
                        {line.name}
                        <span className="mt-0.5 block text-xs text-muted-foreground">{line.outlet}</span>
                      </td>
                      <td className="tabular-nums">{line.qty}</td>
                      <td className="tabular-nums">{formatNu(line.amountNu)}</td>
                      <td>
                        {line.paid ? "Paid" : "Due"}
                        {!line.paid ? (
                          <form action={removeLineAction}>
                            <input type="hidden" name="visitId" value={visit.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <input type="hidden" name="code" value={visit.code} />
                            <input type="hidden" name="back" value="/desk" />
                            <Button type="submit" variant="ghost" size="sm">
                              Delete
                            </Button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </>
              ) : (
                <tr className="border-t border-border">
                  <td className="py-3">New play {rate?.minutes ?? 0} min</td>
                  <td>1</td>
                  <td className="tabular-nums">{formatNu(rate?.amountNu ?? 0)}</td>
                  <td>Not issued</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="till-slip-slot">
          <Card className="till-slip gap-4 overflow-visible rounded-none p-4 ring-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{staffName}</Badge>
            <Badge variant="outline">{staffRole}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{visit ? formatPhone(visit.phone) : "New"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Children</dt>
              <dd className="tabular-nums">{visit?.childCount ?? children}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Until</dt>
              <dd>{visit ? formatWhen(visit.paidUntil) : "After tender"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Due</dt>
              <dd className="font-medium tabular-nums">{formatNu(due)}</dd>
            </div>
          </dl>
          {!openVisit ? (
            <div className="grid gap-3">
              <Field label="Guardian">
                <Input value={name} className="h-12" onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Children">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={children}
                  className="h-12"
                  onChange={(event) => setChildren(Number(event.target.value) || 1)}
                />
              </Field>
            </div>
          ) : (
            <p className="text-sm">{visit?.guardianName || "Guest"}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {openVisit ? (
              <form action={cancelHoldAction}>
                <input type="hidden" name="visitId" value={openVisit.id} />
                <input type="hidden" name="code" value={openVisit.code} />
                <input type="hidden" name="back" value="/desk" />
                <Button type="submit" variant="outline" className="h-11">
                  Remove hold
                </Button>
              </form>
            ) : null}
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
          </div>
          </Card>
        </div>
      </div>
      {tenderOpen && canTender ? (
        <TenderSheet
          action={openVisit ? payPlayAction : checkInAction}
          method={method}
          onMethod={setMethod}
          onScan={setScanNu}
          amountNu={tenderAmount}
          staticPayload={staticPayload}
          note={openVisit ? openVisit.code : `Play ${minutes}m`}
          journalScan={journalScan}
          customer={
            openVisit
              ? { name: openVisit.guardianName, phone: openVisit.phone, children: openVisit.childCount }
              : { name, phone, children }
          }
          onClose={() => setTenderOpen(false)}
        >
          {openVisit ? (
            <>
              <input type="hidden" name="visitId" value={openVisit.id} />
              <input type="hidden" name="code" value={openVisit.code} />
              <input type="hidden" name="back" value="/desk" />
            </>
          ) : (
            <>
              <input type="hidden" name="back" value="/desk" />
              <input type="hidden" name="minutes" value={minutes} />
              <input type="hidden" name="phone" value={phone} />
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="childCount" value={children} />
            </>
          )}
        </TenderSheet>
      ) : null}
      {pass && qr && showPass ? (
        <div className="absolute inset-0 z-30 overflow-auto bg-card p-4">
          <Button type="button" variant="outline" className="mb-3 h-11" onClick={() => setShowPass(false)}>
            Back to till
          </Button>
          <PassCard visit={pass} venueName={venueName} qr={qr} ticketUrl={ticketUrl} />
        </div>
      ) : null}
    </TillShell>
  );
}

function PlayKey({
  minutes,
  visit,
  pressed,
  onPick,
}: {
  minutes: number;
  visit: VisitView | null;
  pressed: boolean;
  onPick: () => void;
}) {
  const label = visit ? `+${minutes} min` : `${minutes} min`;
  if (visit) {
    return (
      <form action={addPlayAction}>
        <input type="hidden" name="visitId" value={visit.id} />
        <input type="hidden" name="code" value={visit.code} />
        <input type="hidden" name="back" value="/desk" />
        <input type="hidden" name="minutes" value={minutes} />
        <Button type="submit" variant={pressed ? "default" : "outline"} className="h-12 w-full">
          {label}
        </Button>
      </form>
    );
  }
  return (
    <Button type="button" variant={pressed ? "default" : "outline"} className="h-12" aria-pressed={pressed} onClick={onPick}>
      {label}
    </Button>
  );
}
