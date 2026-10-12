"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addItemAction, addPlayAction, cancelHoldAction, checkInAction, logoutAction, qtyAction, removeLineAction, removePlayAction, saveKotAction, settleAction } from "@/app/actions";
import { PayQr } from "@/components/pay-qr";
import { Receipt } from "@/components/receipt";
import { PassCard } from "@/components/pass-card";
import { HoldSheet } from "@/components/hold-sheet";
import { KotSlip } from "@/components/kot-slip";
import { GlowTimer, playSpanMinutes } from "@/components/live-timer";
import { RecentSheet } from "@/components/recent-sheet";
import { Scanner } from "@/components/scanner";
import { formatNu, formatPhone, formatWhen, minutesLeft } from "@/lib/format";
import { buildDynamicEmv } from "@/lib/emv";
import { overtimeSentence, quoteOvertime } from "@/lib/overtime";
import { isPoleHello, polePost, POLE_CHANNEL, type PoleLine, type PolePayload } from "@/lib/pole";
import type { MenuItem, Outlet, Rate, RecentTxn, VisitView } from "@/lib/types";

type KotLine = { id: number; name: string; qty: number; outlet: Outlet; note: string };

function kotLines(visit: VisitView): { reprint: boolean; lines: KotLine[] } | null {
  const fresh = visit.lines.flatMap((line) => {
    const delta = line.qty - line.firedQty;
    if (delta === 0) return [];
    return [
      {
        id: line.id,
        name: line.name,
        qty: Math.abs(delta),
        outlet: line.outlet,
        note: delta < 0 ? "Cancel" : line.firedQty > 0 ? `Now ${line.qty}` : "",
      },
    ];
  });
  if (fresh.length) return { reprint: false, lines: fresh };
  if (!visit.lines.length) return null;
  return {
    reprint: true,
    lines: visit.lines.map((line) => ({ id: line.id, name: line.name, qty: line.qty, outlet: line.outlet, note: "" })),
  };
}

function alarmChime() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!alarmCtx || alarmCtx.state === "closed") alarmCtx = new Ctx();
  void alarmCtx.resume();
  [880, 660, 880].forEach((freq, index) => {
    const osc = alarmCtx!.createOscillator();
    const gain = alarmCtx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = alarmCtx!.currentTime + index * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain);
    gain.connect(alarmCtx!.destination);
    osc.start(start);
    osc.stop(start + 0.24);
  });
}

let alarmCtx: AudioContext | null = null;

export function CashierTouch({
  staffName,
  rates,
  menu,
  staticPayload,
  visit,
  open,
  recent,
  todayNu,
  playNu,
  foodNu,
  error,
  ok,
  query,
  qr,
  ticketUrl,
  venueName,
  venueAddress,
  receiptNote,
  receiptThanks,
  receiptRules,
  printTicket = false,
  printReceipt = false,
  holdOpen = false,
}: {
  staffName: string;
  rates: Rate[];
  menu: MenuItem[];
  staticPayload: string;
  visit: VisitView | null;
  open: VisitView[];
  recent: RecentTxn[];
  todayNu: number;
  playNu: number;
  foodNu: number;
  error?: string;
  ok?: string;
  query?: string;
  qr: string;
  ticketUrl: string;
  venueName: string;
  venueAddress: string;
  receiptNote: string;
  receiptThanks: string;
  receiptRules: string;
  printTicket?: boolean;
  printReceipt?: boolean;
  holdOpen?: boolean;
}) {
  const [cam, setCam] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(holdOpen);
  const [quiet, setQuiet] = useState(false);
  const [passOpen, setPassOpen] = useState(printTicket);
  const [now, setNow] = useState(() => Date.now());
  const [tender, setTender] = useState<
    null | { kind: "settle" } | { kind: "checkin"; phone: string; children: number; minutes: number; amountNu: number }
  >(null);
  const [tenderMethod, setTenderMethod] = useState<"cash" | "bank_qr" | "split">("cash");
  const [scanNu, setScanNu] = useState(0);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentIndex, setRecentIndex] = useState(0);
  const [tableNo, setTableNo] = useState(visit?.tableNo ?? "");
  const [kotNote, setKotNote] = useState("");
  const [kotJob, setKotJob] = useState<null | { id: number; tableNo: string; reprint: boolean; when: string; lines: KotLine[] }>(null);
  const kotSeq = useRef(0);
  const router = useRouter();
  const ranked = open
    .map((item) => ({ item, left: minutesLeft(item.paidUntil, now) }))
    .sort((a, b) => a.left - b.left);
  const openVisit = visit?.status === "open" ? visit : null;
  const overtime = openVisit ? quoteOvertime(openVisit.paidUntil, rates, now) : null;
  const due = openVisit
    ? openVisit.dueNu - (openVisit.overtime?.amountNu ?? 0) + (overtime?.amountNu ?? 0)
    : (visit?.dueNu ?? 0);
  const overdue = ranked.filter((row) => row.left < 0).length;
  const ending = ranked.filter((row) => row.left >= 0 && row.left <= 5).length;
  const settled = visit && visit.status !== "open" ? visit : null;
  const lookup = (query ?? "").trim();
  const status = error || ok || (openVisit ? `${formatPhone(openVisit.phone)} is on this till` : lookup ? `No open play card for ${lookup}` : "Alt+L or F10 opens the menu");
  const extra = overtime ? overtimeSentence(overtime) : "";
  const poleRef = useRef<PolePayload | null>(null);

  useEffect(() => {
    const checkin = tender?.kind === "checkin" ? tender : null;
    const lines: PoleLine[] = openVisit
      ? [
          ...openVisit.blocks.map((block) => ({
            name: `Play ${block.minutes} min`,
            qty: 1,
            amount: block.amountNu,
            paid: block.paid,
          })),
          ...(overtime && overtime.amountNu > 0
            ? [
                {
                  name: `Extra ${overtime.extraMinutes} min`,
                  qty: 1,
                  amount: overtime.amountNu,
                  paid: false,
                },
              ]
            : []),
          ...openVisit.lines.map((line) => ({
            name: line.name,
            qty: line.qty,
            amount: line.amountNu,
            paid: line.paid,
          })),
        ]
      : checkin
        ? [{ name: `Play ${checkin.minutes} min`, qty: 1, amount: checkin.amountNu, paid: false }]
        : [];
    const payNu = checkin ? checkin.amountNu : openVisit ? due : 0;
    const scan = tenderMethod === "cash" ? 0 : tenderMethod === "split" ? scanNu : payNu;
    const showQr = Boolean(tender && scan > 0);
    const payload: PolePayload = {
      shop: venueName,
      code: openVisit?.code ?? "",
      phone: openVisit ? formatPhone(openVisit.phone) : checkin ? formatPhone(checkin.phone) : "",
      lines,
      due: payNu,
      payNu: showQr ? scan : 0,
      qr: showQr ? buildDynamicEmv(staticPayload, scan, openVisit ? `Bill ${openVisit.code}` : `Play ${checkin?.minutes}m`) : "",
      extra: openVisit ? extra : "",
      thanks: false,
    };
    poleRef.current = payload;
    polePost(payload);
  }, [openVisit, due, extra, staticPayload, venueName, overtime, tender, tenderMethod, scanNu]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(POLE_CHANNEL);
    channel.onmessage = (event) => {
      if (isPoleHello(event.data) && poleRef.current) polePost(poleRef.current);
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (quiet || overdue === 0) return;
    alarmChime();
    const timer = window.setInterval(alarmChime, 8000);
    return () => window.clearInterval(timer);
  }, [quiet, overdue]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      const alt = event.altKey || event.getModifierState?.("Alt") || event.getModifierState?.("AltGraph");
      const peopleKey = event.key === "F7" || (alt && !event.ctrlKey && !event.metaKey && (event.code === "KeyH" || event.key.toLowerCase() === "h"));
      if (peopleKey) {
        event.preventDefault();
        setMenuOpen(false);
        setRecentOpen(false);
        setPeopleOpen((open) => !open);
        return;
      }
      if (event.key === "PageUp") {
        event.preventDefault();
        setPeopleOpen(false);
        setRecentIndex(0);
        setRecentOpen((open) => !open);
        return;
      }
      if (recentOpen) {
        event.preventDefault();
        if (event.key === "Escape") setRecentOpen(false);
        else if (event.key === "ArrowDown" && recent.length) {
          setRecentIndex((index) => Math.min(recent.length - 1, index + 1));
        } else if (event.key === "ArrowUp") setRecentIndex((index) => Math.max(0, index - 1));
        else if (event.key === "Enter" && recent[recentIndex]) {
          window.location.href = `/receipt/${recent[recentIndex].code}`;
        }
        return;
      }
      if (event.key === "Alt" || event.code === "AltLeft" || event.code === "AltRight" || event.key === "AltGraph") {
        event.preventDefault();
        return;
      }
      const menuKey =
        event.key === "F10" ||
        event.key === "F8" ||
        ["¬", "ﬂ", "Ò", "ł"].includes(event.key) ||
        (alt && (event.code === "KeyL" || event.key.toLowerCase() === "l"));
      if (menuKey && !event.metaKey && !(event.ctrlKey && !alt)) {
        event.preventDefault();
        setPeopleOpen(false);
        setMenuOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        if (peopleOpen) setPeopleOpen(false);
        else if (tender) setTender(null);
        else setMenuOpen(false);
      }
      if (event.key === "F9" && openVisit) {
        event.preventDefault();
        setTenderMethod("cash");
        setTender({ kind: "settle" });
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [tender, openVisit, recentOpen, recent, recentIndex, peopleOpen]);

  useEffect(() => {
    if (!printTicket || !qr) return;
    const timer = window.setTimeout(() => {
      document.body.dataset.print = "ticket";
      window.print();
    }, 300);
    function done() {
      delete document.body.dataset.print;
      const url = new URL(window.location.href);
      url.searchParams.delete("print");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [printTicket, qr]);

  function printSlip() {
    document.body.dataset.print = "receipt";
    const done = () => {
      delete document.body.dataset.print;
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    const url = new URL(window.location.href);
    url.searchParams.delete("print");
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`.replace(/\?$/, ""));
    window.print();
  }

  useEffect(() => {
    if (!printReceipt) return;
    const timer = window.setTimeout(printSlip, 300);
    return () => window.clearTimeout(timer);
  }, [printReceipt]);

  useEffect(() => {
    setTableNo(visit?.tableNo ?? "");
  }, [visit?.id, visit?.tableNo]);

  useEffect(() => {
    if (!kotJob) return;
    const timer = window.setTimeout(() => {
      document.body.dataset.print = "kot";
      const done = () => {
        delete document.body.dataset.print;
        window.removeEventListener("afterprint", done);
      };
      window.addEventListener("afterprint", done);
      window.print();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [kotJob]);

  function sendKot() {
    if (!openVisit) return;
    const table = tableNo.trim();
    if (!table) {
      setKotNote("Type the table number");
      return;
    }
    const job = kotLines(openVisit);
    if (!job) {
      setKotNote("Add food, then print the kitchen ticket");
      return;
    }
    setKotNote("");
    const id = kotSeq.current + 1;
    kotSeq.current = id;
    setKotJob({ id, tableNo: table, reprint: job.reprint, when: formatWhen(new Date().toISOString()), lines: job.lines });
    void saveKotAction(openVisit.id, table, job.reprint ? [] : job.lines.map((line) => line.id)).then(() => router.refresh());
  }

  const receiptLines = visit
    ? [
        ...visit.blocks.map((block) => ({
          name: `Play ${block.minutes} min`,
          qty: 1,
          amount: block.amountNu,
          paid: block.paid,
        })),
        ...(visit.status === "open" && overtime && overtime.amountNu > 0
          ? [{ name: `Extra ${overtime.extraMinutes} min`, qty: 1, amount: overtime.amountNu, paid: false }]
          : []),
        ...visit.lines.map((line) => ({
          name: line.name,
          qty: line.qty,
          amount: line.amountNu,
          paid: line.paid,
        })),
      ]
    : tender?.kind === "checkin"
      ? [{ name: `Play ${tender.minutes} min`, qty: 1, amount: tender.amountNu, paid: false }]
      : [];
  const paying = tender?.kind === "checkin" ? tender.amountNu : visit?.status === "open" ? due : 0;
  const paidCash = visit?.payments.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + payment.amountNu, 0) ?? 0;
  const paidBank = visit?.payments.filter((payment) => payment.method === "bank_qr").reduce((sum, payment) => sum + payment.amountNu, 0) ?? 0;
  const useTender = Boolean(tender) && paying > 0;
  const receiptCash = useTender ? (tenderMethod === "bank_qr" ? 0 : tenderMethod === "split" ? Math.max(0, paying - scanNu) : paying) : paidCash;
  const receiptBank = useTender ? (tenderMethod === "cash" ? 0 : tenderMethod === "split" ? Math.max(0, Math.min(scanNu, paying)) : paying) : paidBank;
  const receiptTotal = useTender ? paying : paidCash + paidBank;

  return (
    <div data-surface="pos" data-touch="cashier">
      <div className="tshong-till">
        <div className="tshong-till-bar">
          <form action="/cashier" className="tshong-till-scan-row">
            <label className="tshong-till-scan-wrap">
              <span>Scan</span>
              <input
                name="q"
                autoFocus
                autoComplete="off"
                inputMode="none"
                aria-label="Scan ticket or phone"
                placeholder="Phone or ticket"
                defaultValue={query ?? ""}
                className="tshong-till-scan"
              />
            </label>
          </form>
          <div className="tshong-due">
            {visit ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.12em]">{overtime ? "Extra time" : "Due"}</p>
                <p className="font-heading text-[1.45rem] leading-none tabular-nums">{formatNu(due)}</p>
                <p className="text-[11px]">
                  {overtime ? `Stayed ${overtime.extraMinutes} min extra` : openVisit ? formatPhone(openVisit.phone) : "Closed"}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-[0.12em]">Playing</p>
                <p className="font-heading text-[1.45rem] leading-none tabular-nums">{ranked.length}</p>
                <p className="text-[11px]">{overdue > 0 ? `${overdue} overtime` : "people"}</p>
              </>
            )}
          </div>
        </div>

        <div className="tshong-till-live">
          <p className={`truncate text-sm ${error || (lookup && !openVisit) ? "text-[var(--danger)]" : ""}`}>{status}</p>
          <button
            type="button"
            className="hold-chip"
            data-alarm={overdue > 0 ? "over" : ending > 0 ? "warn" : "ok"}
            aria-pressed={peopleOpen}
            onClick={() => {
              setMenuOpen(false);
              setRecentOpen(false);
              setPeopleOpen(true);
            }}
          >
            <b>{ranked.length}</b>
            <span>On hold</span>
            {overdue > 0 ? <small>{overdue} overtime</small> : ending > 0 ? <small>{ending} ending</small> : <small>Alt+H</small>}
          </button>
          {overdue > 0 && !quiet ? (
            <button type="button" className="tshong-till-tool" onClick={() => setQuiet(true)}>
              Quiet
            </button>
          ) : null}
          <p className="cash-owner">
            <span>
              <b>{formatNu(todayNu)}</b> today
            </span>
            <span>
              <b>{formatNu(playNu)}</b> play
            </span>
            <span>
              <b>{formatNu(foodNu)}</b> food
            </span>
          </p>
          <div className="tshong-till-actions">
            <div className="tshong-till-tools">
              <button type="button" className="tshong-till-tool" aria-pressed={cam} onClick={() => setCam((value) => !value)}>
                Cam
              </button>
              <button
                type="button"
                className="tshong-till-tool"
                onClick={() => window.open("/display", "tumble-customer", "width=1100,height=800")}
              >
                Screen
              </button>
              {openVisit ? (
                <Link href="/cashier?hold=1" className="tshong-till-tool">
                  Hold
                </Link>
              ) : null}
              {openVisit ? (
                <Link href={`/stickers/${openVisit.code}`} className="tshong-till-tool">
                  Stickers
                </Link>
              ) : null}
              <span className="cash-who">{staffName}</span>
              <form action={logoutAction}>
                <button type="submit" className="tshong-till-tool">
                  Lock
                </button>
              </form>
            </div>
          </div>
        </div>

        {cam ? (
          <div className="border-b border-[var(--line)] bg-[var(--paper)] px-3 py-3">
            <Scanner to="/cashier" defaultOpen />
          </div>
        ) : null}

        <div className="tshong-till-body cash-stage">
          <div className="tshong-till-ticket cash-list">
            {openVisit ? <BillList visit={openVisit} overtime={overtime} /> : <p className="cash-hint">The bill is empty. Alt+L or F10 opens the menu.</p>}
          </div>
          {openVisit ? (
            <PayRail
              visit={openVisit}
              due={due}
              overtime={overtime}
              tableNo={tableNo}
              onTable={setTableNo}
              kotNote={kotNote}
              onTender={(method) => {
                setTenderMethod(method);
                setTender({ kind: "settle" });
              }}
            />
          ) : (
            <StartCard
              rates={rates}
              phone={lookup.replace(/\D/g, "").length === 8 ? lookup.replace(/\D/g, "") : ""}
              settled={settled}
              onTender={(draft, method) => {
                setTenderMethod(method);
                setTender({ kind: "checkin", ...draft });
              }}
            />
          )}
        </div>
        <footer className="tshong-till-keys">
          {openVisit
            ? rates.map((rate) => (
                <form key={rate.minutes} action={addPlayAction} className="contents">
                  <input type="hidden" name="visitId" value={openVisit.id} />
                  <input type="hidden" name="code" value={openVisit.code} />
                  <input type="hidden" name="back" value="/cashier" />
                  <input type="hidden" name="minutes" value={rate.minutes} />
                  <Go className="tshong-fkey">
                    <small>+{rate.minutes}</small>
                    <span>{formatNu(rate.amountNu)}</span>
                  </Go>
                </form>
              ))
            : null}
          {openVisit && openVisit.blocks.some((block) => !block.paid) ? (
            <form action={removePlayAction} className="contents">
              <input type="hidden" name="visitId" value={openVisit.id} />
              <input type="hidden" name="code" value={openVisit.code} />
              <input type="hidden" name="back" value="/cashier" />
              <Go className="tshong-fkey">
                <small>Undo</small>
                <span>Play</span>
              </Go>
            </form>
          ) : null}
          {openVisit ? (
            <Link href="/cashier?hold=1" className="tshong-fkey">
              <small>Hold</small>
              <span>New client</span>
            </Link>
          ) : null}
          <button
            type="button"
            className="tshong-fkey"
            aria-pressed={peopleOpen}
            onClick={() => {
              setMenuOpen(false);
              setRecentOpen(false);
              setPeopleOpen((open) => !open);
            }}
          >
            <small>F7</small>
            <span>People</span>
          </button>
          {openVisit ? (
            <button type="button" className="tshong-fkey" onClick={sendKot}>
              <small>KOT</small>
              <span>Kitchen</span>
            </button>
          ) : null}
          <button type="button" className="tshong-fkey" onClick={() => { setRecentIndex(0); setRecentOpen(true); }}>
            <small>PgUp</small>
            <span>Recent</span>
          </button>
          {openVisit ? (
            <button
              type="button"
              className="tshong-fkey tshong-fkey-go"
              onClick={() => {
                setTenderMethod("cash");
                setTender({ kind: "settle" });
              }}
            >
              <small>F9</small>
              <span>Tender</span>
            </button>
          ) : null}
          <button
            type="button"
            className="tshong-fkey tshong-fkey-go"
            aria-pressed={menuOpen}
            aria-label="F10 Menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <small>F10</small>
            <span>Menu</span>
          </button>
        </footer>
        {peopleOpen ? <HoldSheet visits={open} now={now} currentId={openVisit?.id} onClose={() => setPeopleOpen(false)} /> : null}
        {recentOpen ? (
          <RecentSheet
            recent={recent}
            selected={recentIndex}
            onSelect={setRecentIndex}
            onOpen={(code) => {
              window.location.href = `/receipt/${code}`;
            }}
            onClose={() => setRecentOpen(false)}
          />
        ) : null}
        {menuOpen ? (
          <MenuSheet
            menu={menu}
            visit={openVisit}
            tableNo={tableNo}
            onTable={setTableNo}
            onKot={sendKot}
            onClose={() => setMenuOpen(false)}
          />
        ) : null}
        {tender && (tender.kind === "checkin" || openVisit) ? (
          <TenderSheet
            action={tender.kind === "checkin" ? checkInAction : settleAction}
            method={tenderMethod}
            onMethod={setTenderMethod}
            onScan={setScanNu}
            amountNu={tender.kind === "checkin" ? tender.amountNu : due}
            staticPayload={staticPayload}
            note={tender.kind === "checkin" ? `Play ${tender.minutes}m` : `Bill ${openVisit?.code ?? ""}`}
            onClose={() => setTender(null)}
            onPrint={() => {
              if (openVisit) {
                window.location.href = `/receipt/${openVisit.code}`;
                return;
              }
              printSlip();
            }}
          >
            {tender.kind === "settle" && openVisit ? (
              <>
                <input type="hidden" name="visitId" value={openVisit.id} />
                <input type="hidden" name="code" value={openVisit.code} />
              </>
            ) : tender.kind === "checkin" ? (
              <>
                <input type="hidden" name="back" value="/cashier" />
                <input type="hidden" name="phone" value={tender.phone} />
                <input type="hidden" name="childCount" value={tender.children} />
                <input type="hidden" name="minutes" value={tender.minutes} />
              </>
            ) : null}
          </TenderSheet>
        ) : null}
        {passOpen && visit && qr ? (
          <div className="cash-pass">
            <button type="button" className="tshong-till-action no-print" onClick={() => setPassOpen(false)}>
              Back to till
            </button>
            <PassCard visit={visit} venueName={venueName} qr={qr} ticketUrl={ticketUrl} />
          </div>
        ) : null}
      </div>
      {kotJob && openVisit ? (
        <KotSlip
          venue={venueName}
          tableNo={kotJob.tableNo}
          phone={openVisit.phone}
          code={openVisit.code}
          qr={qr}
          when={kotJob.when}
          reprint={kotJob.reprint}
          lines={kotJob.lines}
        />
      ) : null}
      {receiptLines.length > 0 ? (
        <Receipt
          venue={venueName}
          address={venueAddress}
          when={formatWhen(visit?.closedAt || visit?.createdAt || new Date().toISOString())}
          code={visit?.code ?? ""}
          phone={visit ? formatPhone(visit.phone) : tender?.kind === "checkin" ? formatPhone(tender.phone) : ""}
          lines={receiptLines}
          total={receiptTotal}
          cash={receiptCash}
          bank={receiptBank}
          note={receiptNote}
          thanks={receiptThanks}
          rules={receiptRules.split(/\r?\n/)}
        />
      ) : null}
    </div>
  );
}

function MenuSheet({
  menu,
  visit,
  tableNo,
  onTable,
  onKot,
  onClose,
}: {
  menu: MenuItem[];
  visit: VisitView | null;
  tableNo: string;
  onTable: (value: string) => void;
  onKot: () => void;
  onClose: () => void;
}) {
  const [place, setPlace] = useState<Outlet>("cafe");
  const [find, setFind] = useState("");
  const needle = find.trim().toLowerCase();
  const items = menu.filter((item) => item.outlet === place && (!needle || `${item.name} ${item.category}`.toLowerCase().includes(needle)));
  const categories = [...new Set(items.map((item) => item.category))];

  return (
    <div className="cash-scrim" role="presentation" onClick={onClose}>
      <div className="cash-sheet" role="dialog" aria-label="Menu" onClick={(event) => event.stopPropagation()}>
        <div className="cash-sheet-bar">
          <p>Menu</p>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <input autoFocus value={find} onChange={(event) => setFind(event.target.value)} placeholder="Find a dish" aria-label="Find a dish" className="cash-find" />
        {visit ? (
          <label className="cash-field" style={{ margin: "0.75rem 0.85rem 0" }}>
            Table
            <input value={tableNo} onChange={(event) => onTable(event.target.value.slice(0, 16))} placeholder="Table number" aria-label="Table number" />
          </label>
        ) : null}
        {visit ? (
          <div className="cash-go" style={{ padding: "0.65rem 0.85rem 0" }}>
            <button type="button" className="cash-bank" onClick={onKot}>
              Print kitchen ticket
            </button>
          </div>
        ) : null}
      <div className="cash-places" role="tablist" aria-label="Menu">
        <button type="button" role="tab" aria-selected={place === "cafe"} onClick={() => setPlace("cafe")}>
          Cafe
        </button>
        <button type="button" role="tab" aria-selected={place === "restaurant"} onClick={() => setPlace("restaurant")}>
          Restaurant
        </button>
      </div>
      {visit ? null : <p className="cash-hint">Food is added to the person selected on the right. Start their play card first.</p>}
      {categories.map((category) => (
        <section key={category}>
          <p className="cash-cat">{category}</p>
          <div className="tshong-till-menu">
            {items
              .filter((item) => item.category === category)
              .map((item) =>
                visit ? (
                  <form key={item.id} action={addItemAction} className="contents">
                    <input type="hidden" name="visitId" value={visit.id} />
                    <input type="hidden" name="code" value={visit.code} />
                    <input type="hidden" name="back" value="/cashier" />
                    <input type="hidden" name="outlet" value={item.outlet} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button type="submit">
                      {item.name}
                      <small>{formatNu(item.priceNu)}</small>
                    </button>
                  </form>
                ) : (
                  <button key={item.id} type="button" disabled>
                    {item.name}
                    <small>{formatNu(item.priceNu)}</small>
                  </button>
                ),
              )}
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}

function StartCard({
  rates,
  phone,
  settled,
  onTender,
}: {
  rates: Rate[];
  phone: string;
  settled: VisitView | null;
  onTender: (draft: { phone: string; children: number; minutes: number; amountNu: number }, method: "cash" | "bank_qr") => void;
}) {
  const [number, setNumber] = useState(phone);
  const [children, setChildren] = useState(1);
  const [minutes, setMinutes] = useState(rates[0]?.minutes ?? 60);
  const rate = rates.find((item) => item.minutes === minutes) ?? rates[0];
  const ready = number.replace(/\D/g, "").length === 8;

  return (
    <aside className="tshong-till-rail">
      <section className="cash-person">
        <p className="tshong-till-kicker">New play card</p>
        <p className="cash-hint">
          {settled
            ? `${formatPhone(settled.phone)} was closed. Start a new card to play again.`
            : "Type the mobile number, choose the play time, then open Tender."}
        </p>
      </section>
      <label className="cash-field">
        Mobile number
        <input inputMode="numeric" autoComplete="off" value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="8 digits" />
      </label>
      <label className="cash-field">
        Children
        <input type="number" min={1} max={12} value={children} onChange={(event) => setChildren(Number(event.target.value) || 1)} />
      </label>
      <div className="cash-times">
        {rates.map((item) => (
          <button key={item.minutes} type="button" className="cash-time-key" aria-pressed={minutes === item.minutes} onClick={() => setMinutes(item.minutes)}>
            <span>{item.minutes} min</span>
            <small>{formatNu(item.amountNu)}</small>
          </button>
        ))}
      </div>
      <div className="cash-go">
        <button
          type="button"
          className="cash-cash"
          disabled={!ready || !rate}
          onClick={() => rate && onTender({ phone: number, children, minutes, amountNu: rate.amountNu }, "cash")}
        >
          {rate ? `Tender ${formatNu(rate.amountNu)}` : "Tender"}
        </button>
        <button
          type="button"
          className="cash-bank"
          disabled={!ready || !rate}
          onClick={() => rate && onTender({ phone: number, children, minutes, amountNu: rate.amountNu }, "bank_qr")}
        >
          Bank QR
        </button>
      </div>
    </aside>
  );
}

function BillList({ visit, overtime }: { visit: VisitView; overtime: ReturnType<typeof quoteOvertime> }) {
  const rows = [
    ...visit.blocks.map((block) => ({
      key: `play-${block.id}`,
      kind: "play" as const,
      name: `Play ${block.minutes} min`,
      meta: "Play",
      amount: block.amountNu,
      paid: block.paid,
      qty: 1,
      line: null,
    })),
    ...(overtime && overtime.amountNu > 0
      ? [
          {
            key: "overtime",
            kind: "play" as const,
            name: `Extra ${overtime.extraMinutes} min`,
            meta:
              overtime.billedMinutes === overtime.extraMinutes
                ? "Past play time"
                : `Charged as ${overtime.blocks.map((block) => `${block.minutes} min`).join(" + ")}`,
            amount: overtime.amountNu,
            paid: false,
            qty: 1,
            line: null,
          },
        ]
      : []),
    ...visit.lines.map((line) => ({
      key: `line-${line.id}`,
      kind: line.outlet,
      name: line.name,
      meta: line.outlet === "cafe" ? "Cafe" : "Restaurant",
      amount: line.amountNu,
      paid: line.paid,
      qty: line.qty,
      line,
    })),
  ];
  const bill = rows.reduce((sum, row) => sum + row.amount, 0) || 1;
  const mix = [
    { kind: "play", label: "Play", amount: visit.blocks.reduce((sum, block) => sum + block.amountNu, 0) + (overtime?.amountNu ?? 0) },
    { kind: "cafe", label: "Cafe", amount: visit.lines.filter((line) => line.outlet === "cafe").reduce((sum, line) => sum + line.amountNu, 0) },
    { kind: "restaurant", label: "Restaurant", amount: visit.lines.filter((line) => line.outlet === "restaurant").reduce((sum, line) => sum + line.amountNu, 0) },
  ].filter((part) => part.amount > 0);

  if (rows.length === 0) {
    return <p className="cash-hint">Nothing on this bill yet. F10 opens the menu.</p>;
  }

  return (
    <div className="cash-lines">
      <div className="cash-mix" aria-hidden="true">
        <div className="cash-mix-bar">
          {mix.map((part) => (
            <span key={part.kind} data-kind={part.kind} style={{ width: `${(part.amount / bill) * 100}%` }} />
          ))}
        </div>
        <p>
          {mix.map((part) => (
            <span key={part.kind}>
              <i data-kind={part.kind} />
              {part.label} {formatNu(part.amount)}
            </span>
          ))}
        </p>
      </div>
      <div className="cash-line cash-line-head">
        <span>Item</span>
        <span>Qty</span>
        <span>Amount</span>
      </div>
      <ul>
        {rows.map((row, index) => (
          <li key={row.key} className="cash-line" style={{ animationDelay: `${index * 45}ms` }}>
            <span className="cash-line-name">
              <i data-kind={row.kind} />
              <span>
                <strong>{row.name}</strong>
                <small>{row.meta}</small>
                <span className="cash-share">
                  <span data-kind={row.kind} style={{ width: `${Math.max(6, (row.amount / bill) * 100)}%` }} />
                </span>
              </span>
            </span>
            <span className="cash-line-qty">
              {row.line && !row.paid ? (
                <span className="cash-step">
                  <LineQty visit={visit} lineId={row.line.id} outlet={row.line.outlet} delta={-1} label="−" />
                  <em>{row.qty}</em>
                  <LineQty visit={visit} lineId={row.line.id} outlet={row.line.outlet} delta={1} label="+" />
                  <form action={removeLineAction} className="contents">
                    <input type="hidden" name="visitId" value={visit.id} />
                    <input type="hidden" name="lineId" value={row.line.id} />
                    <input type="hidden" name="code" value={visit.code} />
                    <input type="hidden" name="back" value="/cashier" />
                    <button type="submit" className="cash-qty">
                      Del
                    </button>
                  </form>
                </span>
              ) : (
                <em>{row.qty}</em>
              )}
            </span>
            <b className={row.paid ? "is-paid" : ""}>{row.paid ? "Paid" : formatNu(row.amount)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PayRail({
  visit,
  due,
  overtime,
  tableNo,
  onTable,
  kotNote,
  onTender,
}: {
  visit: VisitView;
  due: number;
  overtime: ReturnType<typeof quoteOvertime>;
  tableNo: string;
  onTable: (value: string) => void;
  kotNote: string;
  onTender: (method: "cash" | "bank_qr") => void;
}) {
  return (
    <aside className="tshong-till-rail">
      <section className="cash-person">
        <p className="tshong-till-kicker">This bill</p>
        <GlowTimer end={visit.paidUntil} spanMin={playSpanMinutes(visit.blocks)} />
        <p className="cash-phone">{formatPhone(visit.phone)}</p>
        <p className="cash-code">{visit.code}</p>
        <label className="cash-field">
          Table
          <input value={tableNo} onChange={(event) => onTable(event.target.value.slice(0, 16))} placeholder="Table number" aria-label="Table number" />
        </label>
        {kotNote ? <p className="cash-hint">{kotNote}</p> : null}
        <p className="cash-pill">
          {visit.guardianName ? `${visit.guardianName} · ` : null}
          {visit.childCount} {visit.childCount === 1 ? "child" : "children"}
        </p>
      </section>
      {overtime ? <p className="cash-hint">{overtimeSentence(overtime)}</p> : null}
      <section>
        <p className="tshong-till-kicker">Amount</p>
        <dl className="tshong-till-sum">
          <div>
            <dt>Lines</dt>
            <dd className="tabular-nums">{visit.blocks.length + visit.lines.length}</dd>
          </div>
          <div className="tshong-till-sum-due">
            <dt>Due</dt>
            <dd className="tabular-nums">{formatNu(due)}</dd>
          </div>
        </dl>
      </section>
      <section className="cash-go">
        <p className="tshong-till-kicker">Payment</p>
        {due > 0 ? (
          <>
            <button type="button" className="cash-cash" onClick={() => onTender("cash")}>
              Tender {formatNu(due)}
            </button>
            <button type="button" className="cash-bank" onClick={() => onTender("bank_qr")}>
              Bank QR
            </button>
          </>
        ) : (
          <form action={settleAction}>
            <input type="hidden" name="visitId" value={visit.id} />
            <input type="hidden" name="code" value={visit.code} />
            <input type="hidden" name="method" value="cash" />
            <Go className="cash-cash">Close visit</Go>
          </form>
        )}
        <form action={cancelHoldAction}>
          <input type="hidden" name="visitId" value={visit.id} />
          <input type="hidden" name="code" value={visit.code} />
          <input type="hidden" name="back" value="/cashier" />
          <button type="submit" className="cash-bank">
            Remove hold
          </button>
        </form>
      </section>
    </aside>
  );
}

function LineQty({
  visit,
  lineId,
  outlet,
  delta,
  label,
}: {
  visit: VisitView;
  lineId: number;
  outlet: Outlet;
  delta: number;
  label: string;
}) {
  return (
    <form action={qtyAction} className="contents">
      <input type="hidden" name="visitId" value={visit.id} />
      <input type="hidden" name="lineId" value={lineId} />
      <input type="hidden" name="code" value={visit.code} />
      <input type="hidden" name="back" value="/cashier" />
      <input type="hidden" name="outlet" value={outlet} />
      <input type="hidden" name="delta" value={delta} />
      <button type="submit" className="cash-qty" aria-label={delta < 0 ? "Remove one" : "Add one"}>
        {label}
      </button>
    </form>
  );
}

function TenderSheet({
  action,
  method,
  onMethod,
  onScan,
  amountNu,
  staticPayload,
  note,
  onClose,
  onPrint,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  method: "cash" | "bank_qr" | "split";
  onMethod: (method: "cash" | "bank_qr" | "split") => void;
  onScan: (amountNu: number) => void;
  amountNu: number;
  staticPayload: string;
  note: string;
  onClose: () => void;
  onPrint: () => void;
  children: ReactNode;
}) {
  const [cashDraft, setCashDraft] = useState("");
  const cashNu = Math.max(0, Math.round(Number(cashDraft) || 0));
  const bankNu = method === "bank_qr" ? amountNu : method === "split" ? amountNu - cashNu : 0;
  const splitReady = method !== "split" || (cashNu > 0 && bankNu > 0 && cashNu + bankNu === amountNu);
  const bankReady = bankNu <= 0 || Boolean(staticPayload);

  useEffect(() => {
    onScan(Math.max(0, bankNu));
  }, [bankNu, onScan]);

  return (
    <div className="cash-scrim" role="presentation" onClick={onClose}>
      <form action={action} className="cash-sheet" role="dialog" aria-label="Tender" onClick={(event) => event.stopPropagation()}>
        <div className="cash-sheet-bar">
          <p>Tender</p>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
        <input type="hidden" name="method" value={method} />
        <input type="hidden" name="cashNu" value={method === "split" ? cashNu : 0} />
        <input type="hidden" name="bankNu" value={method === "split" ? Math.max(0, bankNu) : 0} />
        <div className="cash-places" role="tablist" aria-label="How they pay">
          <button type="button" role="tab" aria-selected={method === "cash"} onClick={() => onMethod("cash")}>
            Cash
          </button>
          <button type="button" role="tab" aria-selected={method === "bank_qr"} onClick={() => onMethod("bank_qr")}>
            Bank QR
          </button>
          <button type="button" role="tab" aria-selected={method === "split"} onClick={() => onMethod("split")}>
            Split
          </button>
        </div>
        <div className="cash-go" style={{ padding: "1rem 1.25rem 1.25rem" }}>
          <p className="font-heading text-4xl tabular-nums">{formatNu(amountNu)}</p>
          {method === "split" ? (
            <>
              <label className="cash-field">
                Cash
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={cashDraft}
                  placeholder="0"
                  onChange={(event) => setCashDraft(event.target.value.replace(/\D/g, ""))}
                />
              </label>
              <p className="cash-hint">
                {bankNu > 0
                  ? `Bank QR ${formatNu(bankNu)}. Cash stays in the till.`
                  : cashNu > amountNu
                    ? "Cash is more than the bill."
                    : "Enter the cash. The rest goes on the bank QR."}
              </p>
              {bankNu > 0 ? <PayQr staticPayload={staticPayload} amountNu={bankNu} note={note} /> : null}
            </>
          ) : method === "bank_qr" ? (
            <>
              <PayQr staticPayload={staticPayload} amountNu={amountNu} note={note} />
              <p className="cash-hint">This QR is also on the customer screen. Confirm only after the payment arrives.</p>
            </>
          ) : (
            <p className="cash-hint">Count the cash, then confirm. The bill stays open until you take it.</p>
          )}
          <button type="button" className="cash-bank" onClick={onPrint}>
            Print receipt
          </button>
          <Go className={method === "bank_qr" ? "cash-bank" : "cash-cash"} disabled={!bankReady || !splitReady || amountNu <= 0}>
            {method === "split" ? "Take split" : method === "cash" ? `Take cash ${formatNu(amountNu)}` : "Bank received"}
          </Go>
        </div>
      </form>
    </div>
  );
}

function Go({ className, children, disabled = false }: { className: string; children: ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? "…" : children}
    </button>
  );
}
