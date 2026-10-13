"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import Link from "next/link";
import { Camera, HardDrive, Lock, MessageCircle, Monitor, PersonStanding, Plus, RotateCcw, Sticker, Users } from "lucide-react";
import { addCounterDish, logoutAction, openBackOfficeAction } from "@/app/actions";
import { BankPick } from "@/components/bank-pick";
import { Receipt } from "@/components/receipt";
import { PassCard } from "@/components/pass-card";
import { PrintPortal } from "@/components/print-portal";
import { HoldSheet } from "@/components/hold-sheet";
import { KotSlip } from "@/components/kot-slip";
import { GlowTimer, BarTimer, MiniRing, playSpanMinutes } from "@/components/live-timer";
import { TimeUpSheet } from "@/components/timeup-sheet";
import { RecentSheet } from "@/components/recent-sheet";
import { Scanner } from "@/components/scanner";
import { TenderSheet, type TenderMethod } from "@/components/tender-sheet";
import { TillShell } from "@/components/till-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayQr } from "@/components/pay-qr";
import { chargeRatesOf, formatRate, quoteCharges } from "@/lib/charges";
import { formatNu, formatClock, formatPhone, formatWhen, minutesLeft, tableLabel, tableTone } from "@/lib/format";
import { bankFromJournal } from "@/lib/pay-banks";
import { submitOpenTender, useTillHotkeys } from "@/lib/hotkeys";
import { buildDynamicEmv, staticFromSettings } from "@/lib/emv";
import { overtimeSentence, quoteOvertime } from "@/lib/overtime";
import { isPoleHello, polePost, POLE_CHANNEL, type PoleLine, type PolePayload } from "@/lib/pole";
import { readSentSnapshot, rememberChat, sentIdsFrom, subscribeSent, emptySentSnapshot, whatsAppChat } from "@/lib/whatsapp";
import { lineKeyOf, localCode, visitKey, type TillOp } from "@/lib/till-op";
import { useTillBook } from "@/lib/use-till-book";
import type { MenuItem, Outlet, Rate, RecentTxn, Role, VisitView } from "@/lib/types";

function subscribeTillLayout(onStoreChange: () => void) {
  const phone = window.matchMedia("(max-width: 767px)");
  const wide = window.matchMedia("(min-width: 1024px)");
  phone.addEventListener("change", onStoreChange);
  wide.addEventListener("change", onStoreChange);
  return () => {
    phone.removeEventListener("change", onStoreChange);
    wide.removeEventListener("change", onStoreChange);
  };
}

function readTillLayout() {
  if (window.matchMedia("(max-width: 767px)").matches) return "phone" as const;
  if (window.matchMedia("(max-width: 1023px)").matches) return "tablet" as const;
  return "wide" as const;
}

function useTillLayout() {
  return useSyncExternalStore(subscribeTillLayout, readTillLayout, () => "wide" as const);
}

type KotLine = { id: number; lineKey: string; name: string; qty: number; outlet: Outlet; note: string };
type Ticket = { id: number; kind: "bot" | "kot"; tableNo: string; when: string; lines: KotLine[] };
type VisitHit = {
  code: string;
  phone: string;
  status: "open" | "settled";
  childCount: number;
  tableNo: string;
  createdAt: string;
  dueNu: number;
  kotQty: number;
  botQty: number;
};

function sameHits(current: VisitHit[], next: VisitHit[]) {
  return (
    current.length === next.length &&
    current.every(
      (item, index) =>
        item.code === next[index].code &&
        item.phone === next[index].phone &&
        item.status === next[index].status &&
        item.childCount === next[index].childCount &&
        item.tableNo === next[index].tableNo &&
        item.dueNu === next[index].dueNu &&
        item.kotQty === next[index].kotQty &&
        item.botQty === next[index].botQty,
    )
  );
}
type CheckStep = "kind" | "time" | "phone" | "children" | "pay" | "journal" | "adding";
type CheckDraft = {
  step: CheckStep;
  kind: "walkin" | "play";
  minutes: number;
  phone: string;
  children: string;
  method: "cash" | "bank_qr";
  journal: string;
  bank: string;
  addToId?: number;
  addToCode?: string;
  addToCount?: number;
};

function freshCheck(minutes = 30): CheckDraft {
  return { step: "kind", kind: "play", minutes, phone: "", children: "1", method: "cash", journal: "", bank: "" };
}

function unsentFood(visit: VisitView): KotLine[] {
  return visit.lines.flatMap((line) => {
    const delta = line.qty - line.firedQty;
    if (delta === 0) return [];
    return [
      {
        id: line.id,
        lineKey: lineKeyOf(line),
        name: line.name,
        qty: Math.abs(delta),
        outlet: line.outlet,
        note: delta < 0 ? "Cancel" : line.firedQty > 0 ? `Now ${line.qty}` : "",
      },
    ];
  });
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
  role,
  error: pageError,
  ok,
  query,
  printTicket = false,
  printReceipt = false,
  printPack = false,
  holdOpen = false,
  startNew = false,
}: {
  staffName: string;
  role: Role;
  error?: string;
  ok?: string;
  query?: string;
  printTicket?: boolean;
  printReceipt?: boolean;
  printPack?: boolean;
  holdOpen?: boolean;
  startNew?: boolean;
}) {
  const book = useTillBook(query);
  const rates = book.base.rates;
  const menu = book.base.menu;
  const open = book.open;
  const recent = book.base.recent;
  const playNu = book.base.playNu;
  const kotNu = book.base.kotNu ?? 0;
  const botNu = book.base.botNu ?? 0;
  const visit = book.visit;
  const venueName = book.base.venueName;
  const bankAccount = book.base.bankAccount;
  const journalScan = book.base.journalScan;
  const venueAddress = book.base.address;
  const receiptNote = book.base.receiptNote;
  const receiptThanks = book.base.receiptThanks;
  const receiptRules = book.base.receiptRules;
  const staticPayload = staticFromSettings({
    payload: book.base.bankPayload,
    account: book.base.bankAccount,
    payee: book.base.payee,
    city: book.base.city,
  });
  const [qr, setQr] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [localPack, setLocalPack] = useState(false);
  const showPack = printPack || localPack;
  const error = book.error || pageError;
  const [cam, setCam] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(holdOpen);
  const [quiet, setQuiet] = useState(false);
  const [passOpen, setPassOpen] = useState(printTicket);
  const [now, setNow] = useState(() => Date.now());
  const [tender, setTender] = useState<
    | null
    | { kind: "settle" }
    | { kind: "checkin"; phone: string; name: string; children: number; minutes: number; amountNu: number }
  >(null);
  const [tenderMethod, setTenderMethod] = useState<TenderMethod>("bank_qr");
  const [paidSlip, setPaidSlip] = useState<{
    code: string;
    phone: string;
    when: string;
    lines: { name: string; qty: number; amount: number; paid: boolean }[];
    cash: number;
    bank: number;
    total: number;
    receiptNo: number | null;
  } | null>(null);
  const [scanNu, setScanNu] = useState(0);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentIndex, setRecentIndex] = useState(0);
  const [tableNo, setTableNo] = useState(visit?.tableNo ?? "");
  const [askTable, setAskTable] = useState(false);
  const [tableError, setTableError] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const ticketSeq = useRef(0);
  const restTickets = useRef<Ticket[]>([]);
  const printedTicket = useRef(0);
  const tableRef = useRef<HTMLInputElement>(null);
  const saleRef = useRef<() => void>(() => {});
  const checkForm = useRef<HTMLFormElement>(null);
  const checkField = useRef<HTMLInputElement>(null);
  const [timeUpOpen, setTimeUpOpen] = useState(false);
  const sentSnapshot = useSyncExternalStore(subscribeSent, readSentSnapshot, emptySentSnapshot);
  const sentIds = sentIdsFrom(sentSnapshot);
  const [check, setCheck] = useState<CheckDraft | null>(startNew ? freshCheck() : null);
  const [sendCheck, setSendCheck] = useState(false);
  const [boardAt, setBoardAt] = useState(0);
  const [tab, setTab] = useState("playing");
  const [scanText, setScanText] = useState(query ?? "");
  const [counterClear, setCounterClear] = useState(false);
  const [hits, setHits] = useState<VisitHit[]>([]);
  const [hitAt, setHitAt] = useState(0);
  const [paySheet, setPaySheet] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const layout = useTillLayout();
  const phone = layout === "phone";
  const hitsRef = useRef(hits);
  hitsRef.current = hits;
  const playRates = useMemo(() => [...rates].sort((a, b) => a.minutes - b.minutes), [rates]);
  const playRate = playRates.find((rate) => rate.minutes === (check?.minutes ?? 30)) ?? playRates.find((rate) => rate.minutes === 30) ?? playRates[0] ?? null;
  const ranked = open
    .map((item) => {
      const walkIn = item.childCount === 0 && item.blocks.length === 0;
      const held = Boolean(item.leftAt);
      return { item, walkIn, held, left: walkIn || held ? Number.POSITIVE_INFINITY : minutesLeft(item.paidUntil, now) };
    })
    .sort((a, b) => a.left - b.left);
  const openVisit = visit?.status === "open" ? visit : null;
  const walkIn = Boolean(openVisit && openVisit.childCount === 0 && openVisit.blocks.length === 0);
  const tickets = open
    .map((item) => (openVisit && item.id === openVisit.id ? openVisit : item))
    .filter((item) => item.childCount === 0 || item.lines.length > 0 || item.id === openVisit?.id);
  if (openVisit && !tickets.some((item) => item.id === openVisit.id)) tickets.unshift(openVisit);
  const overtime =
    openVisit && !walkIn
      ? quoteOvertime(openVisit.paidUntil, rates, openVisit.leftAt ? new Date(openVisit.leftAt).getTime() : now, book.base.extraPerMinNu ?? 0)
      : null;
  const charges = chargeRatesOf(book.base);
  const subtotal = openVisit
    ? openVisit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0) +
      openVisit.lines.filter((line) => !line.paid).reduce((sum, line) => sum + line.amountNu, 0) +
      (overtime?.amountNu ?? 0)
    : 0;
  const bill = quoteCharges(subtotal, charges);
  const due = openVisit ? bill.dueNu : (visit?.dueNu ?? 0);
  const chargeRows = [
    bill.serviceNu > 0 ? { name: `S.C. ${formatRate(charges.scPercent)}%`, amount: bill.serviceNu } : null,
    bill.gstNu > 0 ? { name: `GST ${formatRate(charges.gstPercent)}%`, amount: bill.gstNu } : null,
  ].flatMap((row) => (row ? [row] : []));
  const childrenIn = open.reduce((sum, item) => sum + (item.leftAt ? 0 : item.childCount > 0 || item.blocks.length > 0 ? item.childCount : 0), 0);
  const timeUp = ranked.filter((row) => !row.walkIn && !row.held && row.left < 0).sort((a, b) => b.left - a.left);
  const overdue = timeUp.length;
  const ending = ranked.filter((row) => !row.walkIn && !row.held && row.left >= 0 && row.left <= 5).length;
  const lookup = counterClear ? "" : (query ?? "").trim();
  const status = error || ok || (check ? (check.step === "kind" ? "Left and right choose walk-in or play. Enter continues." : check.step === "time" ? "Up and down choose the play time. Enter continues." : "Enter moves on. Escape cancels.") : openVisit ? `${walkIn ? tableLabel(openVisit.tableNo) : formatPhone(openVisit.phone)} is on this till` : counterClear ? "Bill held. The counter is clear." : lookup ? `No open play card for ${lookup}` : "Alt+N asks walk-in or play. Scan a ticket to add food to that family.");
  const extra = overtime ? overtimeSentence(overtime) : "";
  const poleRef = useRef<PolePayload | null>(null);

  useEffect(() => {
    if (openVisit) setCounterClear(false);
  }, [openVisit]);

  useEffect(() => {
    const checkin = tender?.kind === "checkin" ? tender : null;
    const family = check && check.kind === "play" && check.step !== "kind" && playRate ? check : null;
    const familyNu = family ? playRate.amountNu : 0;
    const familyQr = Boolean(family && (family.step === "pay" || family.step === "journal") && family.method === "bank_qr" && familyNu > 0);
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
          ...chargeRows.map((row) => ({ name: row.name, qty: 1, amount: row.amount, paid: false })),
        ]
      : family
        ? [{ name: `Play ${playRate.minutes} min`, qty: 1, amount: familyNu, paid: false }]
        : checkin
          ? [{ name: `Play ${checkin.minutes} min`, qty: 1, amount: checkin.amountNu, paid: false }]
          : [];
    const payNu = family ? familyNu : checkin ? checkin.amountNu : openVisit ? due : 0;
    const scan = familyQr ? familyNu : tenderMethod === "cash" ? 0 : tenderMethod === "split" ? scanNu : payNu;
    const showQr = familyQr || Boolean(tender && scan > 0);
    const payload: PolePayload = {
      shop: venueName,
      code: openVisit?.code ?? "",
      phone: openVisit ? formatPhone(openVisit.phone) : family ? formatPhone(family.phone) : checkin ? formatPhone(checkin.phone) : "",
      lines,
      due: payNu,
      payNu: showQr ? scan : 0,
      qr: showQr ? buildDynamicEmv(staticPayload, scan, openVisit ? `Bill ${openVisit.code}` : `Play ${playRate?.minutes ?? checkin?.minutes ?? ""}m`) : "",
      extra: openVisit ? extra : "",
      thanks: false,
    };
    poleRef.current = payload;
    polePost(payload);
  }, [openVisit, due, extra, staticPayload, venueName, overtime, tender, tenderMethod, scanNu, check, playRate]);

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

  const markChat = useCallback((id: number) => {
    rememberChat(id);
  }, []);

  useEffect(() => {
    if (!visit?.code) {
      setQr("");
      setTicketUrl("");
      return;
    }
    const url = `${window.location.origin}/t/${visit.code}`;
    setTicketUrl(url);
    let cancel = false;
    void import("qrcode").then((mod) =>
      mod.toDataURL(url, {
        margin: 1,
        width: 360,
        errorCorrectionLevel: "M",
        color: { dark: "#1f4d3a", light: "#ffffff" },
      }),
    ).then((data) => {
      if (!cancel) setQr(data);
    });
    return () => {
      cancel = true;
    };
  }, [visit?.code]);

  useEffect(() => {
    if (!openVisit) setTab("playing");
  }, [openVisit?.code]);

  useEffect(() => {
    if (quiet || overdue === 0) return;
    alarmChime();
    const timer = window.setInterval(alarmChime, 8000);
    return () => window.clearInterval(timer);
  }, [quiet, overdue]);

  useTillHotkeys((letter) => {
    if (letter === "h") {
      setMenuOpen(false);
      setRecentOpen(false);
      setTimeUpOpen(false);
      setPeopleOpen((open) => !open);
      return;
    }
    if (letter === "l" && !recentOpen) {
      setPeopleOpen(false);
      setMenuOpen((open) => !open);
      return;
    }
    if (letter === "s") saleRef.current();
    if (letter === "n") beginCheckIn();
    if (letter === "w") beginWalkIn();
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.type === "keydown" && event.key === "F7") {
        event.preventDefault();
        setMenuOpen(false);
        setRecentOpen(false);
        setTimeUpOpen(false);
        setPeopleOpen((open) => !open);
        return;
      }
      if (event.type !== "keydown" || event.repeat) return;
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
      const menuKey = event.key === "F10" || event.key === "F8" || ["¬", "ﬂ", "Ò", "ł"].includes(event.key);
      if (menuKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setPeopleOpen(false);
        setMenuOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        if (document.querySelector("[data-play-phone], [data-new-dish]")) return;
        if (check) setCheck(null);
        else if (timeUpOpen) setTimeUpOpen(false);
        else if (peopleOpen) setPeopleOpen(false);
        else if (askTable) setAskTable(false);
        else if (tender) setTender(null);
        else setMenuOpen(false);
      }
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      const onBoard = !typing && !check && !menuOpen && !recentOpen && !peopleOpen && !timeUpOpen && !askTable && !tender && tab === "playing" && ranked.length > 0;
      if (onBoard && (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const board = document.querySelector<HTMLElement>("[data-play-board]");
        const columns = Math.max(1, board ? getComputedStyle(board).gridTemplateColumns.split(" ").filter(Boolean).length : 1);
        const found = openVisit ? ranked.findIndex((row) => row.item.id === openVisit.id) : boardAt;
        const at = found < 0 ? 0 : Math.min(found, ranked.length - 1);
        let next = at;
        const column = at % columns;
        if (event.key === "ArrowRight" && column < columns - 1 && at + 1 < ranked.length) next = at + 1;
        if (event.key === "ArrowLeft" && column > 0) next = at - 1;
        if (event.key === "ArrowDown" && at + columns < ranked.length) next = at + columns;
        if (event.key === "ArrowUp" && at - columns >= 0) next = at - columns;
        if (next === at) {
          const order = ["playing", ...tickets.map((item) => item.code)];
          const tabIndex = Math.max(0, order.indexOf(tab));
          const leavingBack = (event.key === "ArrowLeft" && at === 0) || (event.key === "ArrowUp" && at < columns);
          const leavingForward = (event.key === "ArrowRight" && at === ranked.length - 1) || (event.key === "ArrowDown" && at + columns >= ranked.length);
          if (!leavingBack && !leavingForward) return;
          const dest = order[(tabIndex + (leavingForward ? 1 : -1) + order.length) % order.length] ?? "playing";
          setTab(dest);
          if (dest !== "playing") book.openBill(dest);
          return;
        }
        setBoardAt(next);
        book.openBill(ranked[next].item.code);
        const card = document.querySelector<HTMLButtonElement>(`[data-board-card="${ranked[next].item.id}"]`);
        card?.focus();
        card?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (!typing && !check && !menuOpen && !recentOpen && !peopleOpen && !timeUpOpen && !askTable && !tender && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        const order = ["playing", ...tickets.map((item) => item.code)];
        const index = Math.max(0, order.indexOf(tab));
        const step = event.key === "ArrowRight" ? 1 : -1;
        const next = order[(index + step + order.length) % order.length] ?? "playing";
        event.preventDefault();
        setTab(next);
        if (next !== "playing") book.openBill(next);
        return;
      }
      if (onBoard) {
        if (event.key === "Enter") {
          const current = openVisit ? ranked.find((row) => row.item.id === openVisit.id) : ranked[Math.min(boardAt, ranked.length - 1)];
          if (!current) return;
          event.preventDefault();
          setTab(current.item.code);
          book.openBill(current.item.code);
          return;
        }
        if (event.key.toLowerCase() === "w") {
          const current = openVisit ? ranked.find((row) => row.item.id === openVisit.id) : ranked[Math.min(boardAt, ranked.length - 1)];
          if (current && !current.walkIn && current.left < 0) {
            event.preventDefault();
            markChat(current.item.id);
            window.open(whatsAppChat(current.item.phone, venueName, Math.abs(current.left)), "_blank", "noopener");
          }
        }
      }
      if (event.key === "F9" && openVisit) {
        event.preventDefault();
        saleRef.current();
      }
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, [tender, openVisit, recentOpen, recent, recentIndex, peopleOpen, timeUpOpen, askTable, check, menuOpen, ranked, boardAt, venueName, tab, tickets, book, markChat]);

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
    if (!paidSlip) return;
    const timer = window.setTimeout(() => {
      document.body.dataset.print = "receipt";
      const done = () => {
        delete document.body.dataset.print;
        window.removeEventListener("afterprint", done);
        setPaidSlip(null);
      };
      window.addEventListener("afterprint", done);
      window.print();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [paidSlip]);

  useEffect(() => {
    setTableNo(visit?.tableNo ?? "");
  }, [visit?.id, visit?.tableNo]);

  function openTender() {
    setAskTable(false);
    setTenderMethod("bank_qr");
    setTender({ kind: "settle" });
  }

  function confirmTable() {
    if (!openVisit) return;
    const table = tableNo.trim();
    if (!table) {
      setTableError("Type the table number");
      tableRef.current?.focus();
      return;
    }
    const fresh = unsentFood(openVisit);
    setAskTable(false);
    setTableError("");
    if (!fresh.length) {
      if (due > 0) openTender();
      return;
    }
    const when = new Date().toISOString();
    const jobs: Ticket[] = [];
    const bot = fresh.filter((line) => line.outlet === "cafe");
    const kot = fresh.filter((line) => line.outlet === "restaurant");
    if (bot.length) {
      ticketSeq.current += 1;
      jobs.push({ id: ticketSeq.current, kind: "bot", tableNo: table, when, lines: bot });
    }
    if (kot.length) {
      ticketSeq.current += 1;
      jobs.push({ id: ticketSeq.current, kind: "kot", tableNo: table, when, lines: kot });
    }
    void book.commit({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      kind: "saveKot",
      visitKey: visitKey(openVisit),
      tableNo: table,
      lineKeys: fresh.map((line) => line.lineKey),
    });
    restTickets.current = jobs.slice(1);
    setTicket(jobs[0] ?? null);
  }

  function printTickets() {
    if (!openVisit) return;
    if (askTable) {
      confirmTable();
      return;
    }
    if (!unsentFood(openVisit).length) return;
    setTableError("");
    setAskTable(true);
  }

  function beginSale() {
    if (check) return;
    if (tender) {
      submitOpenTender();
      return;
    }
    if (!openVisit) return;
    if (askTable) {
      confirmTable();
      return;
    }
    setMenuOpen(false);
    setPeopleOpen(false);
    setRecentOpen(false);
    if ((openVisit.childCount > 0 || openVisit.blocks.length > 0) && !openVisit.leftAt) {
      book.commit({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind: "holdPlay",
        visitKey: visitKey(openVisit),
      });
      return;
    }
    if (unsentFood(openVisit).length) {
      setTableError("");
      setAskTable(true);
      return;
    }
    if (due > 0) openTender();
    else if (!overtime && (openVisit.childCount > 0 || openVisit.blocks.length > 0)) {
      book.commit({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        kind: "leave",
        visitKey: visitKey(openVisit),
      });
    }
  }

  saleRef.current = beginSale;

  useEffect(() => {
    if (askTable) tableRef.current?.focus();
  }, [askTable]);

  useEffect(() => {
    if (!askTable) return;
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const spots = tableSpots(open);
        if (!spots.length) return;
        event.preventDefault();
        const index = spots.findIndex((spot) => spot.name.toLowerCase() === tableNo.trim().toLowerCase());
        const step = event.key === "ArrowRight" ? 1 : -1;
        const next = spots[(Math.max(0, index) + step + spots.length) % spots.length];
        if (next) {
          setTableError("");
          setTableNo(next.name.slice(0, 16));
        }
        return;
      }
      if (event.key !== "Enter") return;
      event.preventDefault();
      saleRef.current();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [askTable, open, tableNo]);

  function beginCheckIn() {
    setMenuOpen(false);
    setPeopleOpen(false);
    setRecentOpen(false);
    setTimeUpOpen(false);
    setMoreOpen(false);
    setPaySheet(false);
    setAskTable(false);
    setTender(null);
    const minutes = rates.find((rate) => rate.minutes === 30)?.minutes ?? rates[0]?.minutes ?? 30;
    setCheck(freshCheck(minutes));
  }

  function openScanned(raw: string) {
    setScanText("");
    setHits([]);
    void book.recall(raw).then((found) => {
      if (!found) return;
      if (found.status !== "open") {
        window.location.href = `/receipt/${found.code}`;
        return;
      }
      setCheck(null);
      setTender(null);
      setAskTable(false);
      setPeopleOpen(false);
      setRecentOpen(false);
      setTimeUpOpen(false);
      book.openBill(found.code);
      setTab(found.code);
      setMenuOpen(true);
    });
  }

  function openHit(hit: VisitHit) {
    openScanned(hit.code);
  }

  useEffect(() => {
    const term = scanText.trim();
    if (!term) {
      setHits((current) => (current.length === 0 ? current : []));
      setHitAt((current) => (current === 0 ? current : 0));
      return;
    }
    const needle = term.toLowerCase();
    const local = open.flatMap((item) => {
      const blob = `${item.code} ${item.phone} ${item.tableNo}`.toLowerCase();
      if (!blob.includes(needle)) return [];
      return [
        {
          code: item.code,
          phone: item.phone,
          status: item.status,
          childCount: item.childCount,
          tableNo: item.tableNo,
          createdAt: item.createdAt,
          dueNu: item.dueNu,
          kotQty: item.lines.filter((line) => line.outlet === "restaurant").reduce((sum, line) => sum + line.qty, 0),
          botQty: item.lines.filter((line) => line.outlet === "cafe").reduce((sum, line) => sum + line.qty, 0),
        },
      ];
    });
    setHits((current) => (sameHits(current, local) ? current : local));
    if (!sameHits(hitsRef.current, local)) setHitAt(0);
    const timer = window.setTimeout(() => {
      void fetch(`/api/till/search?q=${encodeURIComponent(term)}`)
        .then((response) => (response.ok ? response.json() : { hits: [] }))
        .then((body: { hits?: VisitHit[] }) => {
          const remote = body.hits ?? [];
          const seen = new Set(local.map((item) => item.code));
          const merged = [...local, ...remote.filter((item) => !seen.has(item.code))].slice(0, 8);
          setHits((current) => (sameHits(current, merged) ? current : merged));
        })
        .catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [scanText, open]);

  function beginWalkIn() {
    setCheck(null);
    setTender(null);
    setAskTable(false);
    setPeopleOpen(false);
    setRecentOpen(false);
    setTimeUpOpen(false);
    setMoreOpen(false);
    setPaySheet(false);
    setCounterClear(false);
    book.setSelectedCode("");
    setTab("playing");
    setMenuOpen(true);
  }

  function holdCounter() {
    setCheck(null);
    setTender(null);
    setAskTable(false);
    setTableError("");
    setPeopleOpen(false);
    setRecentOpen(false);
    setTimeUpOpen(false);
    setMenuOpen(false);
    setMoreOpen(false);
    setPaySheet(false);
    setHits([]);
    setScanText("");
    setTab("playing");
    setCounterClear(true);
    book.openBill("");
  }

  function showFloor() {
    setCheck(null);
    setMenuOpen(false);
    setPeopleOpen(false);
    setRecentOpen(false);
    setTimeUpOpen(false);
    setMoreOpen(false);
    setPaySheet(false);
    setTab("playing");
  }

  useEffect(() => {
    if (!startNew) return;
    setCheck((current) => current ?? freshCheck());
    const url = new URL(window.location.href);
    if (!url.searchParams.has("new")) return;
    url.searchParams.delete("new");
    const next = `${url.pathname}${url.search}`;
    window.history.replaceState(null, "", next);
  }, [startNew]);

  useEffect(() => {
    if (check) checkField.current?.focus();
  }, [check?.step]);

  useEffect(() => {
    if (!sendCheck || !check) return;
    setSendCheck(false);
    checkForm.current?.requestSubmit();
  }, [sendCheck, check]);

  useEffect(() => {
    if (!check) return;
    const draft = check;
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.type !== "keydown") return;
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (draft.step === "kind") {
          if (draft.kind === "walkin") beginWalkIn();
          else setCheck({ ...draft, step: "time" });
        } else if (draft.step === "time") {
          setCheck({ ...draft, step: "phone" });
        } else if (draft.step === "phone" && draft.phone.length === 8) {
          const match = open.find((item) => item.phone === draft.phone && (item.childCount > 0 || item.blocks.length > 0));
          if (match) {
            setCheck({ ...draft, step: "adding", addToId: match.id, addToCode: match.code, addToCount: match.childCount, children: "1" });
          } else setCheck({ ...draft, step: "children" });
        } else if (draft.step === "adding") {
          const more = Number(draft.children);
          if (more >= 1 && (draft.addToCount ?? 0) + more <= 12) setSendCheck(true);
        }
        else if (draft.step === "children") {
          const count = Number(draft.children);
          if (count >= 1 && count <= 12) setCheck({ ...draft, step: "pay" });
        } else if (draft.step === "pay") {
          setCheck({ ...draft, method: "bank_qr", step: "journal" });
        } else if (draft.step === "journal" && draft.journal.trim() && (draft.bank || bankFromJournal(draft.journal))) setSendCheck(true);
        return;
      }
      if (draft.step === "kind" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        event.stopPropagation();
        setCheck({ ...draft, kind: draft.kind === "walkin" ? "play" : "walkin" });
        return;
      }
      if (
        draft.step === "time" &&
        (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight")
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (!playRates.length) return;
        const index = playRates.findIndex((rate) => rate.minutes === draft.minutes);
        const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const next = playRates[(Math.max(0, index) + step + playRates.length) % playRates.length];
        if (next) setCheck({ ...draft, minutes: next.minutes });
        return;
      }
      if (draft.step !== "pay") return;
      const key = event.key.toLowerCase();
      if (key !== "c" && key !== "b") return;
      event.preventDefault();
      event.stopPropagation();
      if (key === "b") setCheck({ ...draft, method: "bank_qr", step: "journal" });
      else {
        setCheck({ ...draft, method: "cash" });
        setSendCheck(true);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [check, open, playRates]);

  useEffect(() => {
    if (!showPack || !qr || !visit?.code) return;
    const mark = `tumble-pack:${visit.code}`;
    if (sessionStorage.getItem(mark) === "1") return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(mark, "1");
      document.body.dataset.print = "sticker";
      window.print();
    }, 400);
    function done() {
      delete document.body.dataset.print;
      setLocalPack(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("print");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
      delete document.body.dataset.print;
    };
  }, [showPack, qr, visit?.code]);

  useEffect(() => {
    if (!ticket) return;
    const job = ticket;
    const timer = window.setTimeout(() => {
      if (printedTicket.current === job.id) return;
      printedTicket.current = job.id;
      document.body.dataset.print = "kot";
      const done = () => {
        delete document.body.dataset.print;
        window.removeEventListener("afterprint", done);
        const next = restTickets.current.shift() ?? null;
        setTicket(next);
      };
      window.addEventListener("afterprint", done);
      window.print();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [ticket]);

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
        ...(visit.status === "open" ? chargeRows.map((row) => ({ name: row.name, qty: 1, amount: row.amount, paid: false })) : []),
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
    <TillShell
      touch="cashier"
      headClass="till-command"
      scanAction="/cashier"
      scanDefault={query}
      scanValue={scanText}
      onScanChange={setScanText}
      onScanKeyDown={(event) => {
        if (!hits.length) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const step = event.key === "ArrowDown" ? 1 : -1;
          setHitAt((index) => (index + step + hits.length) % hits.length);
        } else if (event.key === "Enter") {
          event.preventDefault();
          const hit = hits[Math.min(hitAt, hits.length - 1)];
          if (hit) openHit(hit);
        } else if (event.key === "Escape") {
          setHits([]);
        }
      }}
      scanExtra={
        hits.length ? (
          <ul className="till-hits" role="listbox" aria-label="Matching bills">
            {hits.map((hit, index) => (
              <li key={hit.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === hitAt}
                  onMouseEnter={() => setHitAt(index)}
                  onClick={() => openHit(hit)}
                >
                  <strong>
                    {hit.phone.length === 8 ? formatPhone(hit.phone) : hit.code}
                    <span>{hit.code}</span>
                  </strong>
                  <small>
                    {hit.status === "open" ? "Open" : "Past"}
                    {hit.childCount ? ` · ${hit.childCount} ${hit.childCount === 1 ? "child" : "children"}` : ""}
                    {hit.tableNo ? ` · ${tableLabel(hit.tableNo)}` : ""}
                    {hit.kotQty ? ` · KOT ${hit.kotQty}` : ""}
                    {hit.botQty ? ` · BOT ${hit.botQty}` : ""}
                    {hit.dueNu > 0 ? ` · ${formatNu(hit.dueNu)}` : ""}
                    {` · ${formatClock(hit.createdAt)}`}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : null
      }
      onFind={openScanned}
      inputMode={phone ? "text" : "none"}
      scanPlaceholder="Phone or ticket"
      lead={<BackOfficeButton role={role} />}
      dueEyebrow={visit ? (overtime ? "Extra time" : "Due") : "Playing"}
      dueValue={visit ? formatNu(due) : String(childrenIn)}
      dueHint={
        visit
          ? overtime
            ? `Stayed ${overtime.extraMinutes} min extra`
            : openVisit
              ? `Came ${formatClock(openVisit.createdAt)}`
              : "Closed"
          : overdue > 0
            ? `${overdue} overtime`
            : "children"
      }
      status={status}
      statusBad={Boolean(error || (lookup && !openVisit))}
      info={
        <div className="till-info desk-meters">
          <button
            type="button"
            className="desk-meter"
            data-tone="live"
            data-alarm={overdue > 0 ? "over" : ending > 0 ? "warn" : "ok"}
            aria-pressed={peopleOpen}
            onClick={() => {
              setMenuOpen(false);
              setRecentOpen(false);
              setTimeUpOpen(false);
              setPeopleOpen(true);
            }}
          >
            <b>{childrenIn}</b>
            <span>In play</span>
            {overdue > 0 ? <small>{overdue} overtime</small> : ending > 0 ? <small>{ending} ending</small> : <small>Alt+H</small>}
          </button>
          <button
            type="button"
            className="desk-meter"
            data-tone="quiet"
            data-alarm={overdue > 0 ? "over" : "ok"}
            aria-pressed={timeUpOpen}
            onClick={() => {
              setMenuOpen(false);
              setRecentOpen(false);
              setPeopleOpen(false);
              setTimeUpOpen(true);
            }}
          >
            <b>{overdue}</b>
            <span>Time&apos;s up</span>
            <small>{overdue > 0 ? "Open the list" : "Clear"}</small>
          </button>
          {overdue > 0 && !quiet ? (
            <Button type="button" variant="outline" className="h-8 self-center" onClick={() => setQuiet(true)}>
              Quiet
            </Button>
          ) : null}
          <div className="desk-money">
            <p>
              <small>KOT</small>
              <b>{formatNu(kotNu)}</b>
            </p>
            <p>
              <small>BOT</small>
              <b>{formatNu(botNu)}</b>
            </p>
            <p>
              <small>Play</small>
              <b>{formatNu(playNu)}</b>
            </p>
            <p>
              <small>Children</small>
              <b>{childrenIn}</b>
            </p>
          </div>
          <p className="desk-sync" data-state={book.pending > 0 ? "local" : book.ready ? "saved" : "opening"}>
            <i aria-hidden="true" />
            {book.pending > 0 ? "On this till" : book.ready ? "Saved" : "Opening"}
          </p>
        </div>
      }
      tools={
        <div className="desk-tools">
          <div className="desk-cluster">
            <Button type="button" variant={book.backupOn ? "secondary" : "ghost"} className="h-8" onClick={() => void book.chooseBackup()}>
              <HardDrive aria-hidden />
              {book.backupOn ? "Backup on" : "Backup"}
            </Button>
            <Button type="button" variant="ghost" className="h-8" onClick={() => void book.restoreBackup()}>
              <RotateCcw aria-hidden />
              Restore
            </Button>
          </div>
          <div className="desk-cluster">
            <Button type="button" variant={cam ? "secondary" : "ghost"} className="h-8" aria-pressed={cam} onClick={() => setCam((value) => !value)}>
              <Camera aria-hidden />
              Camera
            </Button>
            <Button type="button" variant="ghost" className="h-8" onClick={() => window.open("/display", "tumble-customer", "width=1100,height=800")}>
              <Monitor aria-hidden />
              Screen
            </Button>
          </div>
          <div className="desk-actions">
            <Button type="button" variant="secondary" className="h-8" onClick={beginWalkIn}>
              <PersonStanding aria-hidden />
              Walk-in
            </Button>
            <Button type="button" className="h-8" onClick={beginCheckIn}>
              <Plus aria-hidden />
              New
            </Button>
            {openVisit ? (
              <Button variant="outline" className="h-8" asChild>
                <Link href={`/stickers/${openVisit.code}`}>
                  <Sticker aria-hidden />
                  Stickers
                </Link>
              </Button>
            ) : null}
          </div>
          <div className="desk-session">
            <span className="desk-staff">
              <span aria-hidden="true">{staffName.slice(0, 1).toUpperCase()}</span>
              {staffName}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="h-8">
                <Lock aria-hidden />
                Lock
              </Button>
            </form>
          </div>
        </div>
      }
    >
        {cam ? (
          <div className="border-b border-[var(--line)] bg-[var(--paper)] px-3 py-3">
            <Scanner to="/cashier" defaultOpen />
          </div>
        ) : null}

        <div className="tshong-till-body cash-stage" data-rail={check || paySheet ? "open" : "idle"}>
          <div className="tshong-till-ticket cash-list">
            <Tabs value={tab} onValueChange={setTab} className="cash-tabs min-h-0 flex-1">
              <TabsList variant="line" className="h-9 w-fit max-w-full justify-start gap-0 overflow-x-auto px-1">
                <TabsTrigger value="playing" className="h-9 flex-none px-2.5">Playing</TabsTrigger>
                {tickets.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.code}
                    data-table={tableTone(item.tableNo)}
                    className="h-9 flex-none px-2.5"
                    onClick={() => book.openBill(item.code)}
                  >
                    {item.childCount === 0 && item.blocks.length === 0 ? tableLabel(item.tableNo) : formatPhone(item.phone)}
                    <Badge variant="secondary">
                      {item.lines.reduce((sum, line) => sum + line.qty, 0) || item.childCount}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="playing" className="min-h-0 overflow-auto">
                {ranked.length ? (
                  <ul data-play-board="" className="cash-board list-none gap-3 p-3" aria-label="Open visits">
                    {ranked.map((row, index) => {
                      const on = openVisit ? row.item.id === openVisit.id : index === Math.min(boardAt, ranked.length - 1);
                      const time = row.left < 0 ? "over" : row.left <= 5 ? "ending" : "ok";
                      const label = row.walkIn ? tableLabel(row.item.tableNo) : formatPhone(row.item.phone);
                      const dishes = row.item.lines;
                      const preview = dishes.slice(0, 2).map((line) => (line.qty > 1 ? `${line.name} ×${line.qty}` : line.name));
                      const more = dishes.length - preview.length;
                      const place = row.item.tableNo.trim() ? tableLabel(row.item.tableNo) : "No table";
                      const detail = row.walkIn
                        ? `${dishes.reduce((sum, line) => sum + line.qty, 0)} items`
                        : `${row.item.childCount} ${row.item.childCount === 1 ? "child" : "children"}`;
                      return (
                        <li key={row.item.id} className="aspect-video min-w-0">
                          <Card
                            size="sm"
                            data-play-card=""
                            data-wash={String(Math.abs(row.item.id * 17 + row.item.code.length) % 8)}
                            data-kind={row.walkIn ? "walkin" : row.held ? "held" : "play"}
                            data-on={on ? "1" : "0"}
                            data-time={time}
                            className={`relative h-full gap-0 overflow-hidden border-0 py-0 shadow-sm ${on ? "ring-2 ring-primary" : ""}`}
                          >
                            <button
                              type="button"
                              data-board-card={row.item.id}
                              tabIndex={on ? 0 : -1}
                              aria-current={on ? "true" : undefined}
                              aria-label={label}
                              className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => {
                                setBoardAt(index);
                                setTab(row.item.code);
                                book.openBill(row.item.code);
                              }}
                            />
                            <div className="pointer-events-none relative z-[1] flex h-full flex-col justify-between p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <CardTitle className="truncate text-base tabular-nums">{label}</CardTitle>
                                  {dishes.length ? (
                                    <div className="mt-1 grid gap-0.5 text-xs text-foreground/80">
                                      <p className="truncate font-medium text-foreground">{place}</p>
                                      {preview.length ? (
                                        <p className="line-clamp-2">
                                          {preview.join(", ")}
                                          {more > 0 ? ` +${more}` : ""}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                                <CardAction className="static col-auto row-auto">
                                  {row.walkIn || row.held ? (
                                    <span className="font-heading text-base tabular-nums">{formatNu(row.item.dueNu)}</span>
                                  ) : (
                                    <MiniRing end={row.item.paidUntil} spanMin={playSpanMinutes(row.item.blocks)} />
                                  )}
                                </CardAction>
                              </div>
                              <CardDescription className={`flex flex-wrap items-center gap-1.5 ${!row.walkIn && row.left < 0 ? "pr-24" : ""}`}>
                                <Badge variant={time === "over" ? "destructive" : time === "ending" ? "secondary" : "outline"}>
                                  {row.walkIn ? "Walk-in" : row.held ? "Pay held" : time === "over" ? "Overtime" : time === "ending" ? "Ending" : "On time"}
                                </Badge>
                                <span className="inline-flex items-center gap-1">
                                  <Users aria-hidden className="size-3.5" />
                                  {detail}
                                </span>
                              </CardDescription>
                            </div>
                            {!row.walkIn && row.left < 0 ? (
                              <Button variant={sentIds.includes(row.item.id) ? "outline" : "default"} size="xs" className="absolute right-2.5 bottom-2.5 z-10" asChild>
                                <a
                                  href={whatsAppChat(row.item.phone, venueName, Math.abs(row.left))}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => markChat(row.item.id)}
                                >
                                  <MessageCircle aria-hidden />
                                  {sentIds.includes(row.item.id) ? "Sent" : "WhatsApp"}
                                </a>
                              </Button>
                            ) : null}
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="cash-hint">No one is playing. Alt+N asks walk-in or play. Scan a ticket to add food to that family.</p>
                )}
              </TabsContent>
              {tickets.map((item) => (
                <TabsContent key={item.id} value={item.code} className="min-h-0 overflow-auto">
                  <BillTab
                    visit={item}
                    active={tab === item.code}
                    venueName={venueName}
                    staffName={staffName}
                    onQty={(line, delta) =>
                      book.commit({
                        id: crypto.randomUUID(),
                        at: new Date().toISOString(),
                        kind: "qty",
                        visitKey: visitKey(item),
                        lineKey: lineKeyOf(line),
                        delta,
                      })
                    }
                    onDrop={(line) =>
                      book.commit({
                        id: crypto.randomUUID(),
                        at: new Date().toISOString(),
                        kind: "removeLine",
                        visitKey: visitKey(item),
                        lineKey: lineKeyOf(line),
                      })
                    }
                    onDeliver={(line) =>
                      book.commit({
                        id: crypto.randomUUID(),
                        at: new Date().toISOString(),
                        kind: "deliverKot",
                        visitKey: visitKey(item),
                        lineKeys: [lineKeyOf(line)],
                      })
                    }
                    onVoid={(line, next, secret) =>
                      book.commit({
                        id: crypto.randomUUID(),
                        at: new Date().toISOString(),
                        kind: "voidLine",
                        visitKey: visitKey(item),
                        lineKey: lineKeyOf(line),
                        nextQty: next,
                        secret,
                      })
                    }
                  />
                </TabsContent>
              ))}
            </Tabs>
          </div>
          {check ? (
            <CheckInSheet
              venueName={venueName}
              draft={check}
              rates={playRates}
              rate={playRate}
              staticPayload={staticPayload}
              fieldRef={checkField}
              formRef={checkForm}
              onChange={setCheck}
              onClose={() => setCheck(null)}
              onWalkIn={beginWalkIn}
              onCheckIn={(draft) => {
                if (!playRate) return;
                const code = localCode();
                const saved = book.commit({
                  id: crypto.randomUUID(),
                  at: new Date().toISOString(),
                  kind: "checkIn",
                  visitKey: crypto.randomUUID(),
                  code,
                  phone: draft.phone,
                  name: "",
                  childCount: Math.max(1, Number(draft.children) || 1),
                  minutes: draft.minutes || playRate.minutes,
                  method: draft.method,
                  journal: draft.journal,
                  payBank: draft.bank || bankFromJournal(draft.journal),
                });
                if (!saved) return;
                setCheck(null);
                setLocalPack(true);
                book.openBill(code);
                setTab(code);
              }}
              onAdd={(draft) => {
                const match = open.find((item) => item.id === draft.addToId);
                if (!match) return;
                const saved = book.commit({
                  id: crypto.randomUUID(),
                  at: new Date().toISOString(),
                  kind: "addChildren",
                  visitKey: visitKey(match),
                  childCount: Math.max(1, Number(draft.children) || 1),
                });
                if (!saved) return;
                setCheck(null);
                setLocalPack(true);
                book.openBill(match.code);
                setTab(match.code);
              }}
            />
          ) : openVisit ? (
            <PayRail
              venueName={venueName}
              visit={openVisit}
              due={due}
              charges={chargeRows}
              overtime={overtime}
              askTable={askTable}
              tableNo={tableNo}
              tableRef={tableRef}
              tableError={tableError}
              spots={tableSpots(open)}
              onClose={() => setPaySheet(false)}
              onTable={(value) => {
                setTableError("");
                setTableNo(value);
              }}
              onSale={() => saleRef.current()}
              onAddChild={
                openVisit.childCount < 12
                  ? () =>
                      book.commit({
                        id: crypto.randomUUID(),
                        at: new Date().toISOString(),
                        kind: "addChildren",
                        visitKey: visitKey(openVisit),
                        childCount: 1,
                      })
                  : undefined
              }
            />
          ) : (
            <ChildSheet venueName={venueName} visit={counterClear ? null : (ranked[Math.min(boardAt, Math.max(0, ranked.length - 1))]?.item ?? null)} />
          )}
        </div>
        {showPack && visit && qr ? (
          <PrintPortal>
          <div className="cash-print-source">
            <div className="print-sticker-sheet">
              {Array.from({ length: Math.max(1, visit.childCount) }, (_, index) => (
                <article key={index} className="print-sticker">
                  <p>{venueName}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="" />
                  <p className="sticker-code">{visit.code}</p>
                  <p className="sticker-who">{visit.childCount === 1 ? "Child" : `Child ${index + 1}`}</p>
                  <p>{formatPhone(visit.phone)}</p>
                </article>
              ))}
            </div>
          </div>
          </PrintPortal>
        ) : null}
        <nav className="cash-thumb" aria-label="Till">
          <button type="button" aria-pressed={tab === "playing" && !menuOpen && !check && !paySheet && !moreOpen} onClick={showFloor}>
            Floor
          </button>
          <button
            type="button"
            aria-pressed={menuOpen}
            onClick={() => {
              setCheck(null);
              setPaySheet(false);
              setMoreOpen(false);
              setPeopleOpen(false);
              setRecentOpen(false);
              setTimeUpOpen(false);
              setMenuOpen(true);
            }}
          >
            Order
          </button>
          <button type="button" aria-pressed={Boolean(check)} onClick={beginCheckIn}>
            Check-in
          </button>
          <button
            type="button"
            disabled={!openVisit}
            aria-pressed={paySheet}
            onClick={() => {
              if (!openVisit) return;
              setCheck(null);
              setMenuOpen(false);
              setPeopleOpen(false);
              setRecentOpen(false);
              setTimeUpOpen(false);
              setMoreOpen(false);
              setPaySheet(true);
              if (tab === "playing") setTab(openVisit.code);
            }}
          >
            Pay
          </button>
          <button type="button" aria-pressed={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
            More
          </button>
        </nav>
        <footer className="tshong-till-keys">
          {openVisit
            ? rates.map((rate) => (
                <button
                  key={rate.minutes}
                  type="button"
                  className="tshong-fkey"
                  onClick={() =>
                    book.commit({
                      id: crypto.randomUUID(),
                      at: new Date().toISOString(),
                      kind: "addPlay",
                      visitKey: visitKey(openVisit),
                      minutes: rate.minutes,
                    })
                  }
                >
                  <small>+{rate.minutes}</small>
                  <span>{formatNu(rate.amountNu)}</span>
                </button>
              ))
            : null}
          {openVisit && openVisit.blocks.some((block) => !block.paid) ? (
            <button
              type="button"
              className="tshong-fkey"
              onClick={() =>
                book.commit({
                  id: crypto.randomUUID(),
                  at: new Date().toISOString(),
                  kind: "removePlay",
                  visitKey: visitKey(openVisit),
                })
              }
            >
              <small>Undo</small>
              <span>Play</span>
            </button>
          ) : null}
          <button type="button" className="tshong-fkey" onClick={beginWalkIn}>
            <small>Alt+W</small>
            <span>Walk-in</span>
          </button>
          <button type="button" className="tshong-fkey" onClick={beginCheckIn}>
            <small>Alt+N</small>
            <span>New</span>
          </button>
          <button
            type="button"
            className="tshong-fkey"
            aria-pressed={peopleOpen}
            onClick={() => {
              setMenuOpen(false);
              setRecentOpen(false);
              setTimeUpOpen(false);
              setPeopleOpen((open) => !open);
            }}
          >
            <small>F7</small>
            <span>People</span>
          </button>
          {openVisit ? (
            <button type="button" className="tshong-fkey" onClick={printTickets}>
              <small>Print</small>
              <span>Tickets</span>
            </button>
          ) : null}
          <button type="button" className="tshong-fkey" onClick={() => { setRecentIndex(0); setRecentOpen(true); }}>
            <small>PgUp</small>
            <span>Recent</span>
          </button>
          {openVisit ? (
            <button type="button" className="tshong-fkey" onClick={holdCounter}>
              <small>Hold</small>
              <span>Clear</span>
            </button>
          ) : null}
          {openVisit ? (
            <button
              type="button"
              className="tshong-fkey tshong-fkey-go"
              onClick={() => saleRef.current()}
            >
              <small>Alt+S</small>
              <span>{(openVisit.childCount > 0 || openVisit.blocks.length > 0) && !openVisit.leftAt ? "Finish" : "Pay"}</span>
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
        {moreOpen ? (
          <div className="cash-scrim" role="presentation" onClick={() => setMoreOpen(false)}>
            <div className="cash-sheet" role="dialog" aria-modal="true" aria-label="More" onClick={(event) => event.stopPropagation()}>
              <div className="cash-sheet-bar">
                <p>More</p>
                <button type="button" onClick={() => setMoreOpen(false)}>
                  Close
                </button>
              </div>
              <div className="cash-more">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setMenuOpen(false);
                    setRecentOpen(false);
                    setTimeUpOpen(false);
                    setPeopleOpen(true);
                  }}
                >
                  People
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setMenuOpen(false);
                    setPeopleOpen(false);
                    setRecentOpen(false);
                    setTimeUpOpen(true);
                  }}
                >
                  Time&apos;s up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setRecentIndex(0);
                    setRecentOpen(true);
                  }}
                >
                  Recent
                </button>
                {openVisit ? (
                  <Link href={`/stickers/${openVisit.code}`} onClick={() => setMoreOpen(false)}>
                    Stickers
                  </Link>
                ) : null}
                <button type="button" onClick={() => void book.chooseBackup()}>
                  {book.backupOn ? "Backup on" : "Backup"}
                </button>
                <button type="button" onClick={() => void book.restoreBackup()}>
                  Restore
                </button>
                <button type="button" onClick={() => setCam((value) => !value)}>
                  {cam ? "Hide camera" : "Camera"}
                </button>
                <button type="button" onClick={() => window.open("/display", "tumble-customer", "width=1100,height=800")}>
                  Screen
                </button>
                <form action={logoutAction}>
                  <button type="submit">Lock</button>
                </form>
              </div>
            </div>
          </div>
        ) : null}
        {peopleOpen ? (
          <HoldSheet
            visits={open}
            now={now}
            currentId={openVisit?.id}
            venue={venueName}
            staff={staffName}
            onClose={() => setPeopleOpen(false)}
            onOpen={(item) => {
              book.openBill(item.code);
              setTab(item.childCount === 0 || item.lines.length > 0 ? item.code : "playing");
              setPeopleOpen(false);
            }}
            onLeave={(item) =>
              book.commit({ id: crypto.randomUUID(), at: new Date().toISOString(), kind: "leave", visitKey: visitKey(item) })
            }
            onCancel={(item) =>
              book.commit({ id: crypto.randomUUID(), at: new Date().toISOString(), kind: "cancel", visitKey: visitKey(item) })
            }
            onRelease={(item, choice, secret) =>
              book.commit({
                id: crypto.randomUUID(),
                at: new Date().toISOString(),
                kind: choice === "waive" ? "waive" : "voidVisit",
                visitKey: visitKey(item),
                secret,
              })
            }
          />
        ) : null}
        {timeUpOpen ? (
          <TimeUpSheet
            rows={timeUp}
            venue={venueName}
            sentIds={sentIds}
            onSent={markChat}
            onOpen={(code) => {
              book.openBill(code);
              setTimeUpOpen(false);
            }}
            onClose={() => setTimeUpOpen(false)}
          />
        ) : null}
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
            rates={playRates}
            onClose={() => setMenuOpen(false)}
            knownPhone={openVisit && openVisit.phone.length === 8 ? openVisit.phone : ""}
            role={role}
            onCreate={async (draft) => {
              try {
                const item = await addCounterDish(draft);
                book.addMenu(item);
                const lineKey = crypto.randomUUID();
                const key = openVisit ? visitKey(openVisit) : crypto.randomUUID();
                const code = openVisit ? openVisit.code : localCode();
                const saved = book.commit({
                  id: crypto.randomUUID(),
                  at: new Date().toISOString(),
                  kind: "addItem",
                  visitKey: key,
                  lineKey,
                  itemId: item.id,
                  outlet: item.outlet,
                  code,
                });
                if (saved && !openVisit) {
                  book.openBill(code);
                  setTab(code);
                }
              } catch (caught) {
                const message = caught instanceof Error ? caught.message : "";
                book.report(
                  /fetch|network|failed/i.test(message)
                    ? "The menu can be added when this till is online."
                    : message || "The dish was not saved.",
                );
                throw caught;
              }
            }}
            onPlay={(minutes, phone) => {
              if (!openVisit) return;
              const saved = book.commit({
                id: crypto.randomUUID(),
                at: new Date().toISOString(),
                kind: "addPlay",
                visitKey: visitKey(openVisit),
                minutes,
                phone,
              });
              if (!saved) return;
              setLocalPack(true);
              setMenuOpen(false);
            }}
            onAdd={(item) => {
              const lineKey = crypto.randomUUID();
              const key = openVisit ? visitKey(openVisit) : crypto.randomUUID();
              const code = openVisit ? openVisit.code : localCode();
              const saved = book.commit({
                id: crypto.randomUUID(),
                at: new Date().toISOString(),
                kind: "addItem",
                visitKey: key,
                lineKey,
                itemId: item.id,
                outlet: item.outlet,
                code,
              });
              const line =
                saved?.lines.find((row) => lineKeyOf(row) === lineKey) ??
                saved?.lines.filter((row) => !row.paid && row.name === item.name).at(-1);
              if (line) {
                const qtyKey = lineKeyOf(line);
                window.setTimeout(() => {
                  const input = document.querySelector<HTMLInputElement>(`[data-qty-key="${qtyKey}"]`);
                  input?.focus();
                  input?.select();
                }, 0);
              }
              if (!saved || openVisit) return;
              book.openBill(code);
              setTab(code);
            }}
          />
        ) : null}
        {tender && (tender.kind === "checkin" || openVisit) ? (
          <TenderSheet
            action={(formData) => {
              if (!openVisit) return;
              const method = String(formData.get("method") ?? "bank_qr");
              const pay = method === "cash" || method === "split" || method === "bank_qr" ? method : "bank_qr";
              const cashNu = Number(formData.get("cashNu") ?? 0);
              const bankNu = Number(formData.get("bankNu") ?? 0);
              const saved = book.commit({
                id: crypto.randomUUID(),
                at: new Date().toISOString(),
                kind: "settle",
                visitKey: visitKey(openVisit),
                method: pay,
                journal: String(formData.get("journal") ?? ""),
                payBank: String(formData.get("payBank") ?? ""),
                cashNu,
                bankNu,
              });
              if (!saved) return;
              const cash = pay === "bank_qr" ? 0 : pay === "split" ? cashNu : due;
              const bank = pay === "cash" ? 0 : pay === "split" ? bankNu : due;
              setPaidSlip({
                code: saved.code,
                phone: saved.phone,
                when: saved.closedAt || new Date().toISOString(),
                lines: [
                  ...saved.blocks.map((block) => ({
                    name: `Play ${block.minutes} min`,
                    qty: 1,
                    amount: block.amountNu,
                    paid: true,
                  })),
                  ...(overtime && overtime.amountNu > 0
                    ? [{ name: `Extra ${overtime.extraMinutes} min`, qty: 1, amount: overtime.amountNu, paid: true }]
                    : []),
                  ...saved.lines.map((line) => ({
                    name: line.name,
                    qty: line.qty,
                    amount: line.amountNu,
                    paid: true,
                  })),
                  ...chargeRows.map((row) => ({ name: row.name, qty: 1, amount: row.amount, paid: true })),
                ],
                cash,
                bank,
                total: cash + bank,
                receiptNo: saved.receiptNo,
              });
              setTender(null);
            }}
            method={tenderMethod}
            onMethod={setTenderMethod}
            onScan={setScanNu}
            amountNu={tender.kind === "checkin" ? tender.amountNu : due}
            staticPayload={staticPayload}
            note={tender.kind === "checkin" ? `Play ${tender.minutes}m` : `Bill ${openVisit?.code ?? ""}`}
            journalScan={journalScan}
            bill={
              tender.kind === "settle" && openVisit
                ? {
                    code: openVisit.code,
                    lines: openVisit.lines.length,
                    items: openVisit.lines.reduce((sum, line) => sum + line.qty, 0),
                    table: openVisit.tableNo,
                    walkIn: openVisit.childCount === 0 && openVisit.blocks.length === 0,
                  }
                : null
            }
            customer={
              tender.kind === "checkin"
                ? { name: tender.name, phone: tender.phone, children: tender.children }
                : openVisit
                  ? { name: openVisit.guardianName, phone: openVisit.phone, children: openVisit.childCount }
                  : null
            }
            shop={venueName}
            account={bankAccount}
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
                <input type="hidden" name="name" value={tender.name} />
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
      {ticket && openVisit ? (
        <PrintPortal>
        <KotSlip
          venue={venueName}
          tableNo={ticket.tableNo}
          phone={openVisit.phone}
          code={openVisit.code}
          orderedAt={ticket.when}
          staff={staffName}
          reprint={false}
          ticket={ticket.kind}
          lines={ticket.lines}
        />
        </PrintPortal>
      ) : null}
      {paidSlip || receiptLines.length > 0 ? (
        <PrintPortal>
        <Receipt
          venue={venueName}
          address={venueAddress}
          when={formatWhen(paidSlip?.when || visit?.closedAt || visit?.createdAt || new Date().toISOString())}
          code={paidSlip?.code ?? visit?.code ?? ""}
          phone={paidSlip ? formatPhone(paidSlip.phone) : visit ? formatPhone(visit.phone) : tender?.kind === "checkin" ? formatPhone(tender.phone) : ""}
          lines={paidSlip?.lines ?? receiptLines}
          total={paidSlip?.total ?? receiptTotal}
          cash={paidSlip?.cash ?? receiptCash}
          bank={paidSlip?.bank ?? receiptBank}
          note={receiptNote}
          thanks={receiptThanks}
          rules={receiptRules.split(/\r?\n/)}
          number={paidSlip?.receiptNo ?? visit?.receiptNo}
        />
        </PrintPortal>
      ) : null}
    </TillShell>
  );
}

function BillTab({
  visit,
  active,
  venueName,
  staffName,
  onQty,
  onDrop,
  onDeliver,
  onVoid,
}: {
  visit: VisitView;
  active: boolean;
  venueName: string;
  staffName: string;
  onQty: (line: VisitView["lines"][number], delta: number) => void;
  onDrop: (line: VisitView["lines"][number]) => void;
  onDeliver: (line: VisitView["lines"][number]) => void;
  onVoid: (line: VisitView["lines"][number], next: number, secret: string) => void;
}) {
  const rows = [
    ...visit.blocks.map((block) => ({
      key: `play-${block.id}`,
      name: `Play ${block.minutes} min`,
      meta: "Play",
      amount: block.amountNu,
      paid: block.paid,
      qty: null as number | null,
      line: null,
    })),
    ...visit.lines.map((line) => ({
      key: `line-${line.id}-${line.qty}`,
      name: line.name,
      meta: line.outlet === "cafe" ? "Cafe" : "Bar",
      amount: line.amountNu,
      paid: line.paid,
      qty: line.qty,
      line,
    })),
  ];
  const food = rows.flatMap((row) => (row.line && !row.line.paid ? [row.line] : []));
  const [at, setAt] = useState(0);
  const [voiding, setVoiding] = useState<{ lineId: number; next: number } | null>(null);
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (voiding) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (document.querySelector("[data-till-tender], [aria-label='Menu']")) return;
      if (!food.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setAt((index) => (index + step + food.length) % food.length);
        return;
      }
      const line = food[Math.min(at, food.length - 1)];
      if (!line) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (line.firedQty > 0) setVoiding({ lineId: line.id, next: 0 });
        else document.querySelector<HTMLButtonElement>(`[data-drop-line="${line.id}"]`)?.click();
      } else if (event.key === "Enter") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>(`[data-qty-key="${lineKeyOf(line)}"]`);
        input?.focus();
        input?.select();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, at, food, voiding]);
  if (!rows.length) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">This bill is empty. Alt+L adds a dish. Alt+W starts another walk-in.</p>;
  }
  const picked = food[Math.min(at, food.length - 1)];
  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="h-8 w-14 px-2">Qty</TableHead>
          <TableHead className="h-8 px-2">Item</TableHead>
          <TableHead className="h-8 w-24 px-2 text-right">Amount</TableHead>
          <TableHead className="h-8 w-14 px-2" />
        </TableRow>
      </TableHeader>
      <TableBody>
      {rows.map((row) => (
        <TableRow
          key={row.key}
          data-state={row.line && picked?.id === row.line.id ? "selected" : undefined}
        >
          <TableCell className="w-14 px-2 py-1">
            {row.line && !row.line.paid ? (
              <QtyField
                line={row.line}
                onQty={onQty}
                onBelowFired={(next) => setVoiding({ lineId: row.line!.id, next })}
              />
            ) : (
              <span className="inline-flex h-7 w-12 items-center justify-center text-sm tabular-nums">{row.qty ?? 1}</span>
            )}
          </TableCell>
          <TableCell className="max-w-0 py-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{row.name}</span>
              <Badge variant="outline">
                {row.meta}
                {row.line && row.line.firedQty > 0 && (row.line.deliveredQty ?? 0) >= row.line.firedQty
                  ? " · delivered"
                  : row.line && row.line.firedQty > 0
                    ? " · KOT printed"
                    : ""}
                {row.paid ? " · paid" : ""}
              </Badge>
            </div>
          </TableCell>
          <TableCell className="py-1 text-right font-medium tabular-nums">{row.paid ? "Paid" : formatNu(row.amount)}</TableCell>
          <TableCell className="py-1 pr-2 text-right">
            {row.line && !row.line.paid ? (
              <>
                {row.line.outlet === "restaurant" && row.line.firedQty > (row.line.deliveredQty ?? 0) ? (
                  <Button type="button" size="xs" variant="secondary" onClick={() => onDeliver(row.line!)}>
                    Delivered
                  </Button>
                ) : null}
                {row.line.firedQty > 0 ? (
                  <Button type="button" size="xs" variant="ghost" onClick={() => setVoiding({ lineId: row.line!.id, next: 0 })}>
                    Delete
                  </Button>
                ) : (
                  <Button type="button" size="xs" variant="ghost" data-drop-line={row.line.id} onClick={() => onDrop(row.line!)}>
                    Delete
                  </Button>
                )}
              </>
            ) : null}
          </TableCell>
        </TableRow>
      ))}
      </TableBody>
    </Table>
    <LineVoid
      visit={visit}
      venueName={venueName}
      staffName={staffName}
      line={visit.lines.find((line) => line.id === voiding?.lineId) ?? null}
      next={voiding?.next ?? 0}
      onClose={() => setVoiding(null)}
      onVoid={(secret) => {
        const line = visit.lines.find((item) => item.id === voiding?.lineId);
        if (line) onVoid(line, voiding?.next ?? 0, secret);
        setVoiding(null);
      }}
    />
    </>
  );
}

function LineVoid({
  visit,
  venueName,
  staffName,
  line,
  next,
  onClose,
  onVoid,
}: {
  visit: VisitView;
  venueName: string;
  staffName: string;
  line: VisitView["lines"][number] | null;
  next: number;
  onClose: () => void;
  onVoid: (secret: string) => void;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const slipRef = useRef(line);
  if (line) slipRef.current = line;
  const slip = line ?? slipRef.current;
  const [armed, setArmed] = useState(false);
  const [stamp, setStamp] = useState("");
  const [cancelQty, setCancelQty] = useState(0);

  useEffect(() => {
    if (!armed) return;
    document.body.dataset.print = "kot";
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      delete document.body.dataset.print;
      closeRef.current();
    };
    window.addEventListener("afterprint", finish);
    const timer = window.setTimeout(finish, 4000);
    window.print();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
    };
  }, [armed]);

  return (
    <Dialog open={line != null || armed} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void a sent dish</DialogTitle>
          <DialogDescription>
            The kitchen already has this. A manager PIN voids it and prints a cancel.
          </DialogDescription>
        </DialogHeader>
        {slip ? (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const pin = String(new FormData(event.currentTarget).get("secret") ?? "").trim();
              if (!pin || !line) return;
              const qty = Math.max(0, line.firedQty - next);
              onVoid(pin);
              if (qty > 0) {
                setCancelQty(qty);
                setStamp(new Date().toISOString());
                setArmed(true);
                return;
              }
              onClose();
            }}
          >
            <Field label="Manager PIN">
              <Input name="secret" type="text" inputMode="numeric" autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus className="till-secret" />
            </Field>
            <Button type="submit" variant="destructive">
              Void
            </Button>
            {armed ? (
              <PrintPortal>
              <KotSlip
                venue={venueName}
                tableNo={visit.tableNo || "Counter"}
                phone={visit.phone}
                code={visit.code}
                orderedAt={stamp || new Date().toISOString()}
                staff={staffName}
                reprint={false}
                cancel
                ticket={slip.outlet === "cafe" ? "bot" : "kot"}
                lines={[{ name: slip.name, qty: cancelQty, outlet: slip.outlet, note: "Cancel" }]}
              />
              </PrintPortal>
            ) : null}
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ChildSheet({ venueName, visit }: { venueName: string; visit: VisitView | null }) {
  return (
    <aside className="tshong-till-rail cash-paper">
      <div className="cash-receipt">
        <header className="cash-receipt-head">
          <strong>{venueName}</strong>
          <span>Playing</span>
        </header>
        <hr className="cash-receipt-rule" />
        {visit ? (
          <>
            <p className="cash-receipt-row">
              <span>{formatPhone(visit.phone)}</span>
              <b>
                {visit.childCount} {visit.childCount === 1 ? "child" : "children"}
              </b>
            </p>
            <GlowTimer end={visit.paidUntil} spanMin={playSpanMinutes(visit.blocks)} />
            <p className="cash-hint">Alt+L adds food on this play visit. Scan the ticket to open this same family.</p>
          </>
        ) : (
          <p className="cash-hint">Alt+N asks walk-in or play. Play is paid first. Scan the ticket later to add food on that same visit.</p>
        )}
      </div>
    </aside>
  );
}

function CheckInSheet({
  venueName,
  draft,
  rates,
  rate,
  staticPayload,
  fieldRef,
  formRef,
  onChange,
  onClose,
  onWalkIn,
  onCheckIn,
  onAdd,
}: {
  venueName: string;
  draft: CheckDraft;
  rates: Rate[];
  rate: Rate | null;
  staticPayload: string;
  fieldRef: RefObject<HTMLInputElement | null>;
  formRef: RefObject<HTMLFormElement | null>;
  onChange: (next: CheckDraft) => void;
  onClose: () => void;
  onWalkIn: () => void;
  onCheckIn: (draft: CheckDraft) => void;
  onAdd: (draft: CheckDraft) => void;
}) {
  const amount = rate?.amountNu ?? 0;
  const adding = draft.step === "adding";
  const titles: Record<CheckStep, string> = {
    kind: "Walk-in or play",
    time: "Play time",
    phone: "Mobile number",
    children: "Children",
    pay: "Pay",
    journal: "Journal number",
    adding: "More children",
  };

  return (
    <aside className="tshong-till-rail cash-paper">
      <form
        ref={formRef}
        className="cash-receipt"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.step === "kind") {
            if (draft.kind === "walkin") onWalkIn();
            else onChange({ ...draft, step: "time" });
            return;
          }
          if (draft.step === "time") {
            onChange({ ...draft, step: "phone" });
            return;
          }
          if (adding) onAdd(draft);
          else onCheckIn(draft);
        }}
      >
        <header className="cash-receipt-head">
          <button type="button" className="cash-rail-close" onClick={onClose}>
            Close
          </button>
          <strong>{venueName}</strong>
          <span>{adding ? "Add children" : draft.step === "kind" ? "New" : "Check in"}</span>
        </header>
        <hr className="cash-receipt-rule" />
        <p className="cash-receipt-row">
          <span>
            {adding
              ? `${draft.addToCode} · ${draft.addToCount ?? 0} already in`
              : draft.step === "kind"
                ? draft.kind === "walkin"
                  ? "Food, no phone"
                  : "Play, paid first"
                : `Play ${rate?.minutes ?? draft.minutes} min`}
          </span>
          <b>{adding ? "Same bill" : draft.step === "kind" ? (draft.kind === "walkin" ? "Walk-in" : "Play") : formatNu(amount)}</b>
        </p>
        <button type="submit" className="sr-only" tabIndex={-1}>
          Print
        </button>
        <label className="cash-field">
          <span>{titles[draft.step]}</span>
          {draft.step === "kind" ? (
            <div className="grid grid-cols-2 gap-2 normal-case">
              <button type="button" className="cash-time-key" aria-pressed={draft.kind === "walkin"} onClick={onWalkIn}>
                Walk-in
              </button>
              <button
                type="button"
                className="cash-time-key"
                aria-pressed={draft.kind === "play"}
                onClick={() => onChange({ ...draft, kind: "play", step: "time" })}
              >
                Play
              </button>
            </div>
          ) : null}
          {draft.step === "time" ? (
            <div className="grid gap-2 normal-case">
              {rates.length ? (
                rates.map((item) => (
                  <button
                    key={item.minutes}
                    type="button"
                    className="cash-time-key"
                    aria-pressed={item.minutes === draft.minutes}
                    onClick={() => onChange({ ...draft, minutes: item.minutes, step: "phone" })}
                  >
                    {item.minutes} min · {formatNu(item.amountNu)}
                  </button>
                ))
              ) : (
                <p className="cash-hint">No play rates are set.</p>
              )}
            </div>
          ) : null}
          {draft.step === "phone" ? (
            <input
              ref={fieldRef}
              inputMode="numeric"
              autoComplete="off"
              value={draft.phone}
              onChange={(event) => onChange({ ...draft, phone: event.target.value.replace(/\D/g, "").slice(0, 8) })}
            />
          ) : null}
          {draft.step === "children" || draft.step === "adding" ? (
            <input
              ref={fieldRef}
              inputMode="numeric"
              autoComplete="off"
              value={draft.children}
              onChange={(event) => onChange({ ...draft, children: event.target.value.replace(/\D/g, "").slice(0, 2) })}
            />
          ) : null}
          {draft.step === "pay" ? <p className="cash-hint">Enter types the journal number. C is cash.</p> : null}
          {draft.step === "journal" ? (
            <input
              ref={fieldRef}
              autoComplete="off"
              value={draft.journal}
              placeholder="126-…"
              onChange={(event) => {
                const journal = event.target.value.slice(0, 40);
                const found = bankFromJournal(journal);
                onChange({ ...draft, journal, bank: found || draft.bank });
              }}
            />
          ) : null}
        </label>
        {draft.step === "journal" ? <BankPick value={draft.bank || bankFromJournal(draft.journal)} onChange={(bank) => onChange({ ...draft, bank })} /> : null}
        {draft.method === "bank_qr" && (draft.step === "pay" || draft.step === "journal") ? (
          <PayQr staticPayload={staticPayload} amountNu={amount} note={`Play ${rate?.minutes ?? draft.minutes}m`} compact />
        ) : null}
        <p className="cash-hint">
          {draft.step === "kind"
            ? "Left and right choose. Enter continues. Walk-in opens the menu. Play is paid before they go in."
            : draft.step === "time"
              ? "30 min is highlighted. Up and down pick another time. Enter continues."
              : "Enter continues. Escape cancels. After play is paid, scan the ticket to add food on this same visit."}
        </p>
      </form>
    </aside>
  );
}

function MenuSheet({
  menu,
  rates,
  knownPhone,
  role,
  onClose,
  onAdd,
  onPlay,
  onCreate,
}: {
  menu: MenuItem[];
  rates: Rate[];
  knownPhone: string;
  role: Role;
  onClose: () => void;
  onAdd: (item: MenuItem) => void;
  onPlay: (minutes: number, phone: string) => void;
  onCreate: (draft: { name: string; priceNu: number; outlet: Outlet; secret: string }) => Promise<void>;
}) {
  const [find, setFind] = useState("");
  const [at, setAt] = useState(0);
  const [pane, setPane] = useState<"food" | "play">("food");
  const [playAt, setPlayAt] = useState(() => Math.max(0, rates.findIndex((rate) => rate.minutes === 30)));
  const [phoneFor, setPhoneFor] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [dish, setDish] = useState<"name" | "price" | "outlet" | "pin" | null>(null);
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [dishOutlet, setDishOutlet] = useState<Outlet>("cafe");
  const [dishPin, setDishPin] = useState("");
  const needle = find.trim().toLowerCase();
  const rows = useMemo(
    () =>
      menu
        .filter((item) => !needle || `${item.name} ${item.category}`.toLowerCase().includes(needle))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [menu, needle],
  );

  useEffect(() => {
    setAt(0);
  }, [needle]);

  useEffect(() => {
    const picked = document.querySelector('[data-menu-item][data-pick="1"], [data-play-item][data-pick="1"]');
    picked?.scrollIntoView({ block: "nearest" });
  }, [at, playAt, pane, rows]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement && event.target.hasAttribute("data-qty-key")) return;
      if (event.key === "Escape" && (phoneFor != null || dish)) {
        event.preventDefault();
        event.stopPropagation();
        if (phoneFor != null) setPhoneFor(null);
        else if (dish === "pin") setDish("outlet");
        else if (dish === "outlet") setDish("price");
        else if (dish === "price") setDish("name");
        else setDish(null);
        return;
      }
      if (dish) {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          if (dish !== "outlet") return;
          event.preventDefault();
          event.stopPropagation();
          setDishOutlet((current) => (current === "cafe" ? "restaurant" : "cafe"));
          return;
        }
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        if (dish === "name") {
          if (dishName.trim()) setDish("price");
          return;
        }
        if (dish === "price") {
          if (Number(dishPrice) >= 0 && dishPrice !== "") setDish("outlet");
          return;
        }
        if (dish === "outlet") {
          if (role === "admin") {
            void onCreate({ name: dishName.trim(), priceNu: Number(dishPrice), outlet: dishOutlet, secret: "" })
              .then(() => setDish(null))
              .catch(() => undefined);
          } else setDish("pin");
          return;
        }
        if (dishPin.trim()) {
          void onCreate({ name: dishName.trim(), priceNu: Number(dishPrice), outlet: dishOutlet, secret: dishPin.trim() })
            .then(() => setDish(null))
            .catch(() => undefined);
        }
        return;
      }
      if (phoneFor != null) {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          const digits = phone.replace(/\D/g, "");
          if (digits.length === 8) onPlay(phoneFor, digits);
        }
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        setPane((current) => (current === "food" ? "play" : "food"));
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;
      event.preventDefault();
      if (pane === "play") {
        if (!rates.length) return;
        if (event.key === "ArrowDown") {
          setPlayAt((index) => Math.min(rates.length - 1, index + 1));
          return;
        }
        if (event.key === "ArrowUp") {
          setPlayAt((index) => Math.max(0, index - 1));
          return;
        }
        const rate = rates[Math.min(playAt, rates.length - 1)];
        if (rate) {
          setPhone(knownPhone);
          setPhoneFor(rate.minutes);
        }
        return;
      }
      if (!rows.length) return;
      if (event.key === "ArrowDown") {
        setAt((index) => Math.min(rows.length - 1, index + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        setAt((index) => Math.max(0, index - 1));
        return;
      }
      const item = rows[Math.min(at, rows.length - 1)];
      const button = item ? document.querySelector(`[data-menu-item="${item.id}"]`) : null;
      if (button instanceof HTMLButtonElement && !button.disabled) button.click();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [rows, at, pane, rates, playAt, onPlay, phoneFor, phone, knownPhone, dish, dishName, dishPrice, dishOutlet, dishPin, role, onCreate]);

  return (
    <div className="cash-scrim cash-scrim-clear" role="presentation">
      <div className="cash-sheet" role="dialog" aria-label="Menu" onClick={(event) => event.stopPropagation()}>
        <div className="cash-sheet-bar">
          <p>{pane === "play" ? "Play" : "Menu"}</p>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="cash-places" role="tablist" aria-label="Menu">
          <button type="button" role="tab" aria-selected={pane === "food"} onClick={() => setPane("food")}>
            Food
          </button>
          <button type="button" role="tab" aria-selected={pane === "play"} onClick={() => setPane("play")}>
            Play
          </button>
        </div>
        {dish ? null : pane === "food" ? (
          <input autoFocus value={find} onChange={(event) => setFind(event.target.value)} placeholder="Find a dish" aria-label="Find a dish" className="cash-find" />
        ) : phoneFor != null ? (
          <p className="cash-hint">Type the 8-digit mobile. Enter starts the {phoneFor} min timer and prints the QR.</p>
        ) : (
          <p className="cash-hint">Left and right switch. Up and down choose the time. Enter asks for the mobile number.</p>
        )}
        {phoneFor != null ? (
          <input
            data-play-phone=""
            autoFocus
            inputMode="numeric"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="17123456"
            aria-label="Mobile number"
            className="cash-find"
          />
        ) : null}
        {dish ? (
          <div className="grid gap-2 px-4 py-3" data-new-dish="">
            <p className="cash-hint">
              {dish === "name"
                ? "Type the dish name. Enter continues."
                : dish === "price"
                  ? "Type the price in Nu. Enter continues."
                  : dish === "outlet"
                    ? "Left and right choose Cafe or Kitchen. Enter saves it on this table."
                    : "Enter the owner PIN."}
            </p>
            {dish === "name" ? (
              <input data-new-dish="" autoFocus value={dishName} onChange={(event) => setDishName(event.target.value.slice(0, 40))} placeholder="Dish name" aria-label="Dish name" className="cash-find" />
            ) : null}
            {dish === "price" ? (
              <input data-new-dish="" autoFocus inputMode="numeric" value={dishPrice} onChange={(event) => setDishPrice(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="0" aria-label="Price" className="cash-find" />
            ) : null}
            {dish === "outlet" ? (
              <div className="cash-places" role="tablist" aria-label="Counter">
                <button type="button" aria-selected={dishOutlet === "cafe"} onClick={() => setDishOutlet("cafe")}>Cafe</button>
                <button type="button" aria-selected={dishOutlet === "restaurant"} onClick={() => setDishOutlet("restaurant")}>Kitchen</button>
              </div>
            ) : null}
            {dish === "pin" ? (
              <input data-new-dish="" autoFocus value={dishPin} onChange={(event) => setDishPin(event.target.value)} placeholder="Owner PIN" aria-label="Owner PIN" className="cash-find till-secret" />
            ) : null}
          </div>
        ) : null}
        <ul className="cash-menu-list">
          {phoneFor != null || dish ? null : pane === "food" ? (
            <li>
              <button type="button" onClick={() => setDish("name")}>
                <span>
                  New dish
                  <small>Save it on the menu</small>
                </span>
              </button>
            </li>
          ) : null}
          {phoneFor != null || dish ? null : pane === "play" ? (
            rates.length ? (
              rates.map((rate, index) => (
                <li key={rate.minutes}>
                  <button
                    type="button"
                    data-play-item={rate.minutes}
                    data-pick={index === Math.min(playAt, rates.length - 1) ? "1" : "0"}
                    onClick={() => {
                      setPhone(knownPhone);
                      setPhoneFor(rate.minutes);
                    }}
                  >
                    <span>
                      {rate.minutes} min
                      <small>Play</small>
                    </span>
                    <b>{formatNu(rate.amountNu)}</b>
                  </button>
                </li>
              ))
            ) : (
              <li className="cash-hint">No play rates are set.</li>
            )
          ) : (
            <>
              {rows.length ? null : <li className="cash-hint">No match.</li>}
              {rows.map((item) => {
                const picked = rows[Math.min(at, Math.max(rows.length - 1, 0))]?.id === item.id;
                return (
                  <li key={item.id}>
                    <button type="button" data-menu-item={item.id} data-pick={picked ? "1" : "0"} onClick={() => onAdd(item)}>
                      <span>
                        {item.name}
                        <small>{item.category}</small>
                      </span>
                      <b>{formatNu(item.priceNu)}</b>
                    </button>
                  </li>
                );
              })}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

function tableSpots(open: VisitView[]): { name: string; full: boolean }[] {
  const used = open.map((item) => item.tableNo.trim()).filter(Boolean);
  const names = ["1", "2", "3", "4", "5", "6", "7", "8", "Standing", ...used];
  const seen = new Set<string>();
  return names.flatMap((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name, full: used.some((item) => item.toLowerCase() === key) }];
  });
}

function PayRail({
  venueName,
  visit,
  due,
  charges,
  overtime,
  askTable,
  tableNo,
  tableRef,
  tableError,
  spots,
  onTable,
  onClose,
  onSale,
  onAddChild,
}: {
  venueName: string;
  visit: VisitView;
  due: number;
  charges: { name: string; amount: number }[];
  overtime: ReturnType<typeof quoteOvertime>;
  askTable: boolean;
  tableNo: string;
  tableRef: RefObject<HTMLInputElement | null>;
  tableError: string;
  spots: { name: string; full: boolean }[];
  onTable: (value: string) => void;
  onClose?: () => void;
  onSale: () => void;
  onAddChild?: () => void;
}) {
  const itemCount = visit.lines.reduce((sum, line) => sum + line.qty, 0);
  const cafeNu = visit.lines.filter((line) => line.outlet === "cafe" && !line.paid).reduce((sum, line) => sum + line.amountNu, 0);
  const kitchenNu = visit.lines.filter((line) => line.outlet === "restaurant" && !line.paid).reduce((sum, line) => sum + line.amountNu, 0);
  const playNu = visit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0);
  return (
    <aside className="tshong-till-rail cash-paper">
      <div className="cash-receipt">
        <header className="cash-receipt-head">
          {onClose ? (
            <button type="button" className="cash-rail-close cash-pay-close" onClick={onClose}>
              Close
            </button>
          ) : null}
          <strong>{venueName}</strong>
          <span>{visit.code}</span>
        </header>
        <p className="cash-receipt-row">
          <span>{visit.childCount === 0 && visit.blocks.length === 0 ? tableLabel(visit.tableNo) : visit.guardianName || "Guest"}</span>
          <b>{visit.phone.length === 8 ? formatPhone(visit.phone) : visit.code}</b>
        </p>
        {visit.childCount > 0 || visit.blocks.length > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <p className="cash-hint">
              {visit.childCount} {visit.childCount === 1 ? "child" : "children"}
              {visit.tableNo ? ` · ${tableLabel(visit.tableNo)}` : ""}
            </p>
            {onAddChild ? (
              <button type="button" className="cash-time-key h-8 min-h-8 w-auto px-3" onClick={onAddChild}>
                + Child
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="cash-hint">Came {formatClock(visit.createdAt)}</p>
        {visit.receiptNo ? <p className="cash-hint">Receipt {visit.receiptNo}</p> : null}
        {visit.leftAt ? (
          <p className="cash-hint">Left. The clock is stopped. Pay when they are ready.</p>
        ) : visit.blocks.length > 0 ? (
          <BarTimer end={visit.paidUntil} spanMin={playSpanMinutes(visit.blocks)} until={formatWhen(visit.paidUntil)} />
        ) : null}
        <hr className="cash-receipt-rule" />
        <p className="cash-receipt-row">
          <span>Lines</span>
          <b className="tabular-nums">{visit.lines.length}</b>
        </p>
        <p className="cash-receipt-row">
          <span>Items</span>
          <b className="tabular-nums">{itemCount}</b>
        </p>
        {(() => {
          const tiles = [
            playNu > 0 ? { kind: "play", label: "Play", amount: playNu } : null,
            cafeNu > 0 ? { kind: "cafe", label: "Cafe", amount: cafeNu } : null,
            kitchenNu > 0 ? { kind: "bar", label: "Bar", amount: kitchenNu } : null,
            overtime && overtime.amountNu > 0 ? { kind: "extra", label: `Extra ${overtime.extraMinutes} min`, amount: overtime.amountNu } : null,
          ].flatMap((tile) => (tile ? [tile] : []));
          if (!tiles.length) return null;
          return (
            <div className="grid grid-cols-2 gap-2">
              {tiles.map((tile) => (
                <div key={tile.kind} data-bill-card="" data-kind={tile.kind} className="rounded-lg px-3 py-2">
                  <p className="text-xs font-medium text-foreground/70">{tile.label}</p>
                  <p className="font-medium tabular-nums">{formatNu(tile.amount)}</p>
                </div>
              ))}
            </div>
          );
        })()}
        {askTable ? (
          <div className="cash-field">
            <span>Table</span>
            <div className="flex flex-wrap gap-1.5 font-medium tracking-normal normal-case">
              {spots.map((spot) => {
                const picked = tableNo.trim().toLowerCase() === spot.name.toLowerCase();
                return (
                  <Button
                    key={spot.name}
                    type="button"
                    size="sm"
                    variant={picked ? "default" : "outline"}
                    className="h-8 px-2"
                    onClick={() => onTable(spot.name.slice(0, 16))}
                  >
                    {spot.name}
                    {spot.full ? (
                      <Badge variant={picked ? "secondary" : "outline"} className="ml-1">
                        In use
                      </Badge>
                    ) : null}
                  </Button>
                );
              })}
            </div>
            <input
              ref={tableRef}
              value={tableNo}
              onChange={(event) => onTable(event.target.value.slice(0, 16))}
              placeholder="Or type a standing spot"
              aria-label="Table or standing spot"
            />
          </div>
        ) : null}
        {askTable ? (
          <p className="cash-hint">{tableError || "Left and right move the tables. Type Standing when they have no table. Enter prints the tickets and holds this name. Alt+S tenders when they are done."}</p>
        ) : null}
        {overtime ? <p className="cash-hint">{overtimeSentence(overtime)}</p> : null}
        {charges.map((row) => (
          <p key={row.name} className="cash-receipt-row">
            <span>{row.name}</span>
            <b className="tabular-nums">{formatNu(row.amount)}</b>
          </p>
        ))}
        <hr className="cash-receipt-rule" />
        <p className="cash-receipt-total">
          <span>Due</span>
          <b className="tabular-nums">{formatNu(due)}</b>
        </p>
        {(visit.childCount > 0 || visit.blocks.length > 0) && !visit.leftAt ? (
          <p className="cash-hint">Finish stops the clock and holds the bill. Pay is separate, when they stop talking.</p>
        ) : null}
      </div>
        {due > 0 || askTable || ((visit.childCount > 0 || visit.blocks.length > 0) && !visit.leftAt && !overtime) ? (
        <div className="cash-go">
          <button type="button" className="cash-cash" onClick={onSale}>
            {askTable
              ? "Print tickets"
              : (visit.childCount > 0 || visit.blocks.length > 0) && !visit.leftAt
                ? "Finish"
                : `Pay ${formatNu(due)}`}
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function QtyField({
  line,
  onQty,
  onBelowFired,
}: {
  line: VisitView["lines"][number];
  onQty: (line: VisitView["lines"][number], delta: number) => void;
  onBelowFired: (next: number) => void;
}) {
  const [text, setText] = useState(String(line.qty));
  useEffect(() => {
    setText(String(line.qty));
  }, [line.qty]);

  function apply(nextQty: number) {
    const next = Math.round(nextQty);
    if (!Number.isFinite(next) || next === line.qty) {
      setText(String(line.qty));
      return;
    }
    if (next < line.firedQty) {
      setText(String(line.qty));
      onBelowFired(Math.max(0, next));
      return;
    }
    onQty(line, next - line.qty);
  }

  return (
    <Input
      data-qty-key={lineKeyOf(line)}
      inputMode="numeric"
      aria-label={`Quantity for ${line.name}`}
      value={text}
      className="h-7 w-12 px-1 text-center tabular-nums"
      onChange={(event) => setText(event.target.value.replace(/\D/g, "").slice(0, 2))}
      onBlur={() => apply(Number(text))}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          const step = event.key === "ArrowUp" ? 1 : -1;
          apply(line.qty + step);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          apply(Number(text));
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function BackOfficeButton({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  if (role === "admin") {
    return (
      <Button type="button" variant="outline" className="h-10 w-10 shrink-0 px-0" aria-label="Back office" onClick={() => { window.location.href = "/admin"; }}>
        <BurgerMark />
      </Button>
    );
  }
  return (
    <>
      <Button type="button" variant="outline" className="h-10 w-10 shrink-0 px-0" aria-label="Back office" onClick={() => setOpen(true)}>
        <BurgerMark />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Back office</DialogTitle>
            <DialogDescription>Enter the owner PIN or password.</DialogDescription>
          </DialogHeader>
          <form action={openBackOfficeAction} className="grid gap-3">
            <Field label="Owner PIN">
              <Input name="secret" autoFocus autoComplete="off" className="till-secret h-11" />
            </Field>
            <Button type="submit" className="h-11">
              Open
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BurgerMark() {
  return (
    <span className="flex w-4 flex-col gap-1" aria-hidden>
      <span className="block h-0.5 bg-current" />
      <span className="block h-0.5 bg-current" />
      <span className="block h-0.5 bg-current" />
    </span>
  );
}

