"use client";

import { useState } from "react";
import Link from "next/link";
import { addPlayAction, cancelHoldAction, checkInAction, logoutAction, payPlayAction, removeLineAction, removePlayAction } from "@/app/actions";
import { PassCard } from "@/components/pass-card";
import { PayQr } from "@/components/pay-qr";
import { Scanner } from "@/components/scanner";
import { formatNu, formatPhone, formatWhen, minutesLeft } from "@/lib/format";
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
}) {
  const [phone, setPhone] = useState(query ?? "");
  const [name, setName] = useState("");
  const [children, setChildren] = useState(1);
  const [minutes, setMinutes] = useState(rates[0]?.minutes ?? 60);
  const [method, setMethod] = useState<"cash" | "bank_qr">("cash");
  const [cam, setCam] = useState(false);
  const [showPass, setShowPass] = useState(Boolean(issued));
  const rate = rates.find((item) => item.minutes === minutes) ?? rates[0];
  const playDue = visit?.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0) ?? 0;
  const openVisit = visit?.status === "open" ? visit : null;
  const due = openVisit ? openVisit.dueNu : visit ? 0 : rate?.amountNu ?? 0;
  const left = visit ? minutesLeft(visit.paidUntil) : null;
  const pass = issued ?? (showPass ? visit : null);
  const status =
    error ||
    ok ||
    (visit
      ? `${visit.code} · ${formatPhone(visit.phone)}${visit.status === "settled" ? " · closed" : ""}`
      : "Scan a phone or pick play time, then Tender");

  return (
    <div data-surface="pos">
      <div className="tshong-till">
        <div className="tshong-till-bar">
          <form action="/desk" className="tshong-till-scan-row">
            <label className="tshong-till-scan-wrap">
              <span>Scan</span>
              <input
                name="q"
                autoFocus
                autoComplete="off"
                aria-label="Phone or ticket"
                placeholder="8-digit phone or ticket code"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="tshong-till-scan"
              />
            </label>
            <button type="submit" className="tshong-till-cam">
              Find
            </button>
            <button type="button" className="tshong-till-cam" aria-pressed={cam} onClick={() => setCam((openCam) => !openCam)}>
              Cam
            </button>
          </form>
          <div className="tshong-due">
            <p className="text-[10px] uppercase tracking-[0.12em]">
              Due · {visit ? visit.lines.length + visit.blocks.length : 1} ln
            </p>
            <p className="font-heading text-[1.35rem] leading-none tabular-nums">{formatNu(due)}</p>
            <p className="text-[11px]">
              {visit ? (visit.status === "settled" ? "Closed" : left != null && left < 0 ? "Overtime" : "Open visit") : "New play"}
            </p>
          </div>
        </div>

        <div className="tshong-till-live">
          <p className={`truncate text-sm ${error ? "text-[var(--danger)]" : "text-[var(--ink)]"}`}>{status}</p>
          <div className="tshong-till-tabs" role="tablist" aria-label="Open visits">
            {open.slice(0, 6).map((item) => (
              <Link
                key={item.id}
                href={`/desk?q=${item.code}`}
                role="tab"
                aria-selected={visit?.code === item.code}
                className="tshong-till-tab"
              >
                {item.code}
              </Link>
            ))}
          </div>
          <div className="tshong-till-actions">
            <div className="tshong-till-tools">
              <button type="button" className="tshong-till-tool" onClick={() => setShowPass(true)} disabled={!visit && !issued}>
                Ticket
              </button>
              <button
                type="button"
                className="tshong-till-tool"
                aria-pressed={method === "bank_qr"}
                onClick={() => setMethod((current) => (current === "cash" ? "bank_qr" : "cash"))}
              >
                {method === "cash" ? "Cash" : "Bank QR"}
              </button>
              <Tender
                visit={openVisit}
                minutes={minutes}
                method={method}
                playDue={playDue}
                phone={phone}
                name={name}
                children={children}
                disabled={!openVisit && !rate}
              />
            </div>
          </div>
        </div>

        {cam ? (
          <div className="border-b border-[var(--line)] bg-[var(--paper)] px-3 py-2">
            <Scanner to="/desk" defaultOpen />
          </div>
        ) : null}

        <div className="tshong-till-body">
          <div className="tshong-till-ticket">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Amount</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {visit ? (
                  <>
                    {visit.blocks.map((block) => (
                      <tr key={block.id} aria-selected={!block.paid}>
                        <td>Play {block.minutes} min</td>
                        <td className="tabular-nums">1</td>
                        <td className="tabular-nums">{formatNu(block.amountNu)}</td>
                        <td>
                          {block.paid ? "Paid" : "Due"}
                          {!block.paid && visit.blocks[visit.blocks.length - 1]?.id === block.id ? (
                            <form action={removePlayAction}>
                              <input type="hidden" name="visitId" value={visit.id} />
                              <input type="hidden" name="code" value={visit.code} />
                              <input type="hidden" name="back" value="/desk" />
                              <button type="submit" className="tshong-till-action">
                                Delete
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {visit.lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          {line.name}
                          <span className="mt-0.5 block text-[11px] text-[var(--ink-mute)]">{line.outlet}</span>
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
                              <button type="submit" className="tshong-till-action">
                                Delete
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </>
                ) : (
                  <tr aria-selected="true">
                    <td>New play {rate?.minutes ?? 0} min</td>
                    <td>1</td>
                    <td className="tabular-nums">{formatNu(rate?.amountNu ?? 0)}</td>
                    <td>Not issued</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <aside className="tshong-till-rail">
            <section>
              <p className="tshong-till-kicker">On till</p>
              <p className="text-sm">
                {staffName} · {staffRole}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {openVisit ? (
                  <form action={cancelHoldAction}>
                    <input type="hidden" name="visitId" value={openVisit.id} />
                    <input type="hidden" name="code" value={openVisit.code} />
                    <input type="hidden" name="back" value="/desk" />
                    <button type="submit" className="tshong-till-action">
                      Remove hold
                    </button>
                  </form>
                ) : null}
                <form action={logoutAction}>
                  <button type="submit" className="tshong-till-action">
                    Lock
                  </button>
                </form>
                {staffRole === "admin" ? (
                  <Link href="/admin" className="tshong-till-action">
                    Office
                  </Link>
                ) : null}
              </div>
            </section>
            <section>
              <p className="tshong-till-kicker">Bill</p>
              <dl className="tshong-till-sum">
                <div>
                  <dt>Phone</dt>
                  <dd>{visit ? formatPhone(visit.phone) : "New"}</dd>
                </div>
                <div>
                  <dt>Children</dt>
                  <dd className="tabular-nums">{visit?.childCount ?? children}</dd>
                </div>
                <div>
                  <dt>Until</dt>
                  <dd>{visit ? formatWhen(visit.paidUntil) : "After tender"}</dd>
                </div>
                <div className="tshong-till-sum-due">
                  <dt>Grand total</dt>
                  <dd className="tabular-nums">{formatNu(due)}</dd>
                </div>
              </dl>
            </section>
            {!openVisit ? (
              <div className="grid gap-2">
                <label className="text-sm">
                  Guardian
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1 h-9 w-full border border-[var(--line)] bg-[var(--canvas)] px-2"
                  />
                </label>
                <label className="text-sm">
                  Children
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={children}
                    onChange={(event) => setChildren(Number(event.target.value) || 1)}
                    className="mt-1 h-9 w-full border border-[var(--line)] bg-[var(--canvas)] px-2"
                  />
                </label>
              </div>
            ) : null}
            {method === "bank_qr" && due > 0 ? (
              <PayQr staticPayload={staticPayload} amountNu={due} note={visit ? visit.code : `Play ${minutes}m`} />
            ) : null}
          </aside>
        </div>

        <div className="tshong-till-pad">
          {rates.slice(0, 3).map((item) => (
            <PlayKey key={item.minutes} minutes={item.minutes} visit={openVisit} pressed={minutes === item.minutes} onPick={() => setMinutes(item.minutes)} />
          ))}
          <button type="button" className="tshong-till-pad-del" onClick={() => setCam(true)}>
            Scan
          </button>
          <Tender visit={openVisit} minutes={minutes} method={method} playDue={playDue} phone={phone} name={name} children={children} pad />
        </div>

        <footer className="tshong-till-keys" style={{ gridTemplateColumns: `repeat(${Math.max(rates.length + 1, 4)}, minmax(0, 1fr))` }}>
          {rates.map((item) => (
            <PlayKey
              key={item.minutes}
              minutes={item.minutes}
              visit={openVisit}
              pressed={minutes === item.minutes}
              onPick={() => setMinutes(item.minutes)}
              fkey
            />
          ))}
          {openVisit && playDue > 0 ? (
            <form action={removePlayAction} className="contents">
              <input type="hidden" name="visitId" value={openVisit.id} />
              <input type="hidden" name="code" value={openVisit.code} />
              <input type="hidden" name="back" value="/desk" />
              <button type="submit" className="tshong-fkey">
                <small>Del</small>
                <span>Unpaid play</span>
              </button>
            </form>
          ) : (
            <span className="tshong-fkey">
              <small>Desk</small>
              <span>{venueName}</span>
            </span>
          )}
        </footer>
      </div>

      {pass && qr && showPass ? (
        <div className="absolute inset-0 z-30 overflow-auto bg-[var(--paper)] p-4">
          <button type="button" className="tshong-till-action mb-3" onClick={() => setShowPass(false)}>
            Back to till
          </button>
          <PassCard visit={pass} venueName={venueName} qr={qr} ticketUrl={ticketUrl} />
        </div>
      ) : null}
    </div>
  );
}

function PlayKey({
  minutes,
  visit,
  pressed,
  onPick,
  fkey = false,
}: {
  minutes: number;
  visit: VisitView | null;
  pressed: boolean;
  onPick: () => void;
  fkey?: boolean;
}) {
  const className = fkey ? `tshong-fkey ${pressed ? "tshong-fkey-go" : ""}` : undefined;
  const label = (
    <>
      {fkey ? <small>{minutes}</small> : null}
      <span>{fkey ? "min" : visit ? `+${minutes} min` : `${minutes} min`}</span>
    </>
  );
  if (visit) {
    return (
      <form action={addPlayAction} className="contents">
        <input type="hidden" name="visitId" value={visit.id} />
        <input type="hidden" name="code" value={visit.code} />
        <input type="hidden" name="back" value="/desk" />
        <input type="hidden" name="minutes" value={minutes} />
        <button type="submit" className={className} aria-pressed={pressed}>
          {label}
        </button>
      </form>
    );
  }
  return (
    <button type="button" className={className} aria-pressed={pressed} onClick={onPick}>
      {label}
    </button>
  );
}

function Tender({
  visit,
  minutes,
  method,
  playDue,
  phone,
  name,
  children,
  disabled,
  pad = false,
}: {
  visit: VisitView | null;
  minutes: number;
  method: "cash" | "bank_qr";
  playDue: number;
  phone: string;
  name: string;
  children: number;
  disabled?: boolean;
  pad?: boolean;
}) {
  const className = pad ? "tshong-till-pad-go" : "tshong-till-tender-go";
  const label = (
    <>
      <span>Tender</span>
      {pad ? <span className="text-[10px] uppercase">F10</span> : null}
    </>
  );
  if (visit && playDue > 0) {
    return (
      <form action={payPlayAction} className="contents">
        <input type="hidden" name="visitId" value={visit.id} />
        <input type="hidden" name="code" value={visit.code} />
        <input type="hidden" name="back" value="/desk" />
        <input type="hidden" name="method" value={method} />
        <button type="submit" className={className}>
          {label}
        </button>
      </form>
    );
  }
  if (!visit) {
    return (
      <form action={checkInAction} className="contents">
        <input type="hidden" name="minutes" value={minutes} />
        <input type="hidden" name="method" value={method} />
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="childCount" value={children} />
        <button type="submit" className={className} disabled={disabled}>
          {label}
        </button>
      </form>
    );
  }
  return (
    <button type="button" className={className} disabled>
      {label}
    </button>
  );
}
