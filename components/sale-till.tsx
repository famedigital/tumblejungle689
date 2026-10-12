"use client";

import { useState } from "react";
import Link from "next/link";
import {
  addItemAction,
  addPlayAction,
  logoutAction,
  payOutletAction,
  qtyAction,
  removePlayAction,
  settleAction,
} from "@/app/actions";
import { PayQr } from "@/components/pay-qr";
import { Scanner } from "@/components/scanner";
import { formatNu, formatPhone, formatWhen, minutesLeft } from "@/lib/format";
import type { MenuItem, Outlet, Rate, VisitView } from "@/lib/types";

export function SaleTill({
  staffName,
  staffRole,
  title,
  back,
  outlet,
  menu = [],
  rates = [],
  staticPayload,
  visit,
  open,
  error,
  ok,
  query,
  settle = false,
}: {
  staffName: string;
  staffRole: string;
  title: string;
  back: string;
  outlet?: Outlet;
  menu?: MenuItem[];
  rates?: Rate[];
  staticPayload: string;
  visit: VisitView | null;
  open: VisitView[];
  error?: string;
  ok?: string;
  query?: string;
  settle?: boolean;
}) {
  const [cam, setCam] = useState(false);
  const [method, setMethod] = useState<"cash" | "bank_qr">("cash");
  const [lineId, setLineId] = useState<number | null>(null);
  const openVisit = visit?.status === "open" ? visit : null;
  const due = outlet
    ? (visit?.lines.filter((line) => line.outlet === outlet && !line.paid).reduce((sum, line) => sum + line.amountNu, 0) ?? 0)
    : (visit?.dueNu ?? 0);
  const playDue = visit?.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0) ?? 0;
  const left = visit ? minutesLeft(visit.paidUntil) : null;
  const selected = visit?.lines.find((line) => line.id === lineId && !line.paid) ?? null;
  const status =
    error ||
    ok ||
    (visit
      ? `${visit.code} · ${formatPhone(visit.phone)}${visit.status === "settled" ? " · closed" : ""}`
      : `Scan a ticket to ${title.toLowerCase()}`);

  return (
    <div data-surface="pos">
      <div className="tshong-till">
        <div className="tshong-till-bar">
          <form action={back} className="tshong-till-scan-row">
            <label className="tshong-till-scan-wrap">
              <span>Scan</span>
              <input
                name="q"
                autoFocus
                autoComplete="off"
                aria-label="Phone or ticket"
                placeholder="Phone or ticket code"
                defaultValue={query ?? ""}
                className="tshong-till-scan"
              />
            </label>
            <button type="submit" className="tshong-till-cam">
              Find
            </button>
            <button type="button" className="tshong-till-cam" aria-pressed={cam} onClick={() => setCam((value) => !value)}>
              Cam
            </button>
          </form>
          <div className="tshong-due">
            <p className="text-[10px] uppercase tracking-[0.12em]">Due · {visit?.lines.length ?? 0} ln</p>
            <p className="font-heading text-[1.35rem] leading-none tabular-nums">{formatNu(due)}</p>
            <p className="text-[11px]">{visit ? (left != null && left < 0 && visit.status === "open" ? "Overtime" : title) : "No ticket"}</p>
          </div>
        </div>

        <div className="tshong-till-live">
          <p className={`truncate text-sm ${error ? "text-[var(--danger)]" : "text-[var(--ink)]"}`}>{status}</p>
          <div className="tshong-till-tabs" role="tablist" aria-label="Open visits">
            {open.slice(0, 6).map((item) => (
              <Link key={item.id} href={`${back}?q=${item.code}`} role="tab" aria-selected={visit?.code === item.code} className="tshong-till-tab">
                {item.code}
              </Link>
            ))}
          </div>
          <div className="tshong-till-actions">
            <div className="tshong-till-tools">
              <button
                type="button"
                className="tshong-till-tool"
                aria-pressed={method === "bank_qr"}
                onClick={() => setMethod((current) => (current === "cash" ? "bank_qr" : "cash"))}
              >
                {method === "cash" ? "Cash" : "Bank QR"}
              </button>
              <PayButton
                visit={openVisit}
                outlet={outlet}
                method={method}
                due={due}
                settle={settle}
              />
            </div>
          </div>
        </div>

        {cam ? (
          <div className="border-b border-[var(--line)] bg-[var(--paper)] px-3 py-2">
            <Scanner to={back} defaultOpen />
          </div>
        ) : null}

        <div className="tshong-till-body">
          <div className="tshong-till-ticket">
            {outlet && openVisit ? (
              <div className="tshong-till-menu">
                {menu.map((item) => (
                  <form key={item.id} action={addItemAction} className="contents">
                    <input type="hidden" name="visitId" value={openVisit.id} />
                    <input type="hidden" name="code" value={openVisit.code} />
                    <input type="hidden" name="outlet" value={outlet} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button type="submit">
                      {item.name}
                      <small>
                        {item.category} · {formatNu(item.priceNu)}
                      </small>
                    </button>
                  </form>
                ))}
              </div>
            ) : null}
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
                      <tr key={`play-${block.id}`}>
                        <td>Play {block.minutes} min</td>
                        <td className="tabular-nums">1</td>
                        <td className="tabular-nums">{formatNu(block.amountNu)}</td>
                        <td>{block.paid ? "Paid" : "Due"}</td>
                      </tr>
                    ))}
                    {visit.lines.map((line) => (
                      <tr
                        key={line.id}
                        aria-selected={selected?.id === line.id}
                        onClick={() => {
                          if (!line.paid && (!outlet || line.outlet === outlet)) setLineId(line.id);
                        }}
                      >
                        <td>
                          {line.name}
                          <span className="mt-0.5 block text-[11px] text-[var(--ink-mute)]">{line.outlet}</span>
                        </td>
                        <td className="tabular-nums">{line.qty}</td>
                        <td className="tabular-nums">{formatNu(line.amountNu)}</td>
                        <td>{line.paid ? "Paid" : "Due"}</td>
                      </tr>
                    ))}
                  </>
                ) : (
                  <tr>
                    <td colSpan={4}>Scan a play ticket, then add the order.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <aside className="tshong-till-rail">
            <section>
              <p className="tshong-till-kicker">On till</p>
              <p className="text-sm">
                {staffName} · {title}
              </p>
              <form action={logoutAction} className="mt-2">
                <button type="submit" className="tshong-till-action">
                  Lock
                </button>
              </form>
              {staffRole === "admin" ? (
                <Link href="/admin" className="tshong-till-action mt-2">
                  Office
                </Link>
              ) : null}
            </section>
            <section>
              <p className="tshong-till-kicker">Bill</p>
              <dl className="tshong-till-sum">
                <div>
                  <dt>Phone</dt>
                  <dd>{visit ? formatPhone(visit.phone) : "—"}</dd>
                </div>
                <div>
                  <dt>Until</dt>
                  <dd>{visit ? formatWhen(visit.paidUntil) : "—"}</dd>
                </div>
                <div>
                  <dt>Play left</dt>
                  <dd className="tabular-nums">{left == null ? "—" : left < 0 ? `${Math.abs(left)} over` : `${left} min`}</dd>
                </div>
                <div className="tshong-till-sum-due">
                  <dt>{outlet ? "This counter" : "Grand total"}</dt>
                  <dd className="tabular-nums">{formatNu(due)}</dd>
                </div>
              </dl>
            </section>
            {method === "bank_qr" && due > 0 ? (
              <PayQr staticPayload={staticPayload} amountNu={due} note={visit ? `${title} ${visit.code}` : title} />
            ) : null}
          </aside>
        </div>

        <div className="tshong-till-pad">
          <Qty visit={openVisit} outlet={outlet} line={selected} delta={-1} label="− qty" />
          <Qty visit={openVisit} outlet={outlet} line={selected} delta={1} label="+ qty" />
          {settle && openVisit && playDue > 0 ? (
            <form action={removePlayAction} className="contents">
              <input type="hidden" name="visitId" value={openVisit.id} />
              <input type="hidden" name="code" value={openVisit.code} />
              <input type="hidden" name="back" value={back} />
              <button type="submit" className="tshong-till-pad-del">
                Del
              </button>
            </form>
          ) : (
            <button type="button" className="tshong-till-pad-del" onClick={() => setCam(true)}>
              Scan
            </button>
          )}
          <PayButton visit={openVisit} outlet={outlet} method={method} due={due} settle={settle} pad />
        </div>

        {settle ? (
          <footer className="tshong-till-keys" style={{ gridTemplateColumns: `repeat(${Math.max(rates.length, 4)}, minmax(0, 1fr))` }}>
            {rates.map((rate) =>
              openVisit ? (
                <form key={rate.minutes} action={addPlayAction} className="contents">
                  <input type="hidden" name="visitId" value={openVisit.id} />
                  <input type="hidden" name="code" value={openVisit.code} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="minutes" value={rate.minutes} />
                  <button type="submit" className="tshong-fkey">
                    <small>+{rate.minutes}</small>
                    <span>{formatNu(rate.amountNu)}</span>
                  </button>
                </form>
              ) : (
                <span key={rate.minutes} className="tshong-fkey">
                  <small>{rate.minutes}</small>
                  <span>min</span>
                </span>
              ),
            )}
          </footer>
        ) : (
          <footer className="tshong-till-keys">
            <span className="tshong-fkey">
              <small>Till</small>
              <span>{title}</span>
            </span>
            <span className="tshong-fkey">
              <small>Tab</small>
              <span>{due > 0 ? "Open" : "Clear"}</span>
            </span>
            <span className="tshong-fkey">
              <small>Pay</small>
              <span>{method === "cash" ? "Cash" : "QR"}</span>
            </span>
            <span className="tshong-fkey tshong-fkey-go">
              <small>F10</small>
              <span>Tender</span>
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}

function Qty({
  visit,
  outlet,
  line,
  delta,
  label,
}: {
  visit: VisitView | null;
  outlet?: Outlet;
  line: { id: number } | null;
  delta: number;
  label: string;
}) {
  if (!visit || !outlet || !line) {
    return (
      <button type="button" disabled>
        {label}
      </button>
    );
  }
  return (
    <form action={qtyAction} className="contents">
      <input type="hidden" name="lineId" value={line.id} />
      <input type="hidden" name="code" value={visit.code} />
      <input type="hidden" name="outlet" value={outlet} />
      <input type="hidden" name="delta" value={delta} />
      <button type="submit">{label}</button>
    </form>
  );
}

function PayButton({
  visit,
  outlet,
  method,
  due,
  settle,
  pad = false,
}: {
  visit: VisitView | null;
  outlet?: Outlet;
  method: "cash" | "bank_qr";
  due: number;
  settle: boolean;
  pad?: boolean;
}) {
  const className = pad ? "tshong-till-pad-go" : "tshong-till-tender-go";
  const label = (
    <>
      <span>{settle ? "Close" : "Tender"}</span>
      {pad ? <span className="text-[10px] uppercase">F10</span> : null}
    </>
  );
  if (!visit || (due <= 0 && !settle)) {
    return (
      <button type="button" className={className} disabled>
        {label}
      </button>
    );
  }
  if (settle) {
    return (
      <form action={settleAction} className="contents">
        <input type="hidden" name="visitId" value={visit.id} />
        <input type="hidden" name="code" value={visit.code} />
        <input type="hidden" name="method" value={method} />
        <button type="submit" className={className}>
          {label}
        </button>
      </form>
    );
  }
  return (
    <form action={payOutletAction} className="contents">
      <input type="hidden" name="visitId" value={visit.id} />
      <input type="hidden" name="code" value={visit.code} />
      <input type="hidden" name="outlet" value={outlet} />
      <input type="hidden" name="method" value={method} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
