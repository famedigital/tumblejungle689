"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addChildrenAction, addItemAction, addPlayAction, checkInAction, logoutAction, qtyAction, removeLineAction, removePlayAction, saveKotAction, settleAction, voidLineAction } from "@/app/actions";
import { BankPick } from "@/components/bank-pick";
import { Receipt } from "@/components/receipt";
import { PassCard } from "@/components/pass-card";
import { HoldSheet } from "@/components/hold-sheet";
import { KotSlip } from "@/components/kot-slip";
import { GlowTimer, playSpanMinutes } from "@/components/live-timer";
import { RecentSheet } from "@/components/recent-sheet";
import { Scanner } from "@/components/scanner";
import { TenderSheet, type TenderMethod } from "@/components/tender-sheet";
import { TillShell } from "@/components/till-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayQr } from "@/components/pay-qr";
import { formatNu, formatPhone, formatWhen, minutesLeft } from "@/lib/format";
import { bankFromJournal } from "@/lib/pay-banks";
import { submitOpenTender, useTillHotkeys } from "@/lib/hotkeys";
import { buildDynamicEmv } from "@/lib/emv";
import { overtimeSentence, quoteOvertime } from "@/lib/overtime";
import { isPoleHello, polePost, POLE_CHANNEL, type PoleLine, type PolePayload } from "@/lib/pole";
import type { MenuItem, Outlet, Rate, RecentTxn, VisitView } from "@/lib/types";

type KotLine = { id: number; name: string; qty: number; outlet: Outlet; note: string };
type Ticket = { id: number; kind: "bot" | "kot"; tableNo: string; when: string; lines: KotLine[] };
type CheckStep = "phone" | "children" | "pay" | "journal" | "adding";
type CheckDraft = {
  step: CheckStep;
  phone: string;
  children: string;
  method: "cash" | "bank_qr";
  journal: string;
  bank: string;
  addToId?: number;
  addToCode?: string;
  addToCount?: number;
};

function freshCheck(): CheckDraft {
  return { step: "phone", phone: "", children: "1", method: "cash", journal: "", bank: "" };
}

function whatsAppChat(phone: string, venue: string, left: number): string {
  const digits = phone.replace(/\D/g, "").slice(-8);
  const text =
    left < 0
      ? `Play time at ${venue} has ended. Please come to the desk.`
      : `Play time at ${venue} is ending. About ${Math.max(0, left)} minute${left === 1 ? "" : "s"} left.`;
  return `https://wa.me/975${digits}?text=${encodeURIComponent(text)}`;
}

function sessionHasChat(id: number): boolean {
  try {
    return (sessionStorage.getItem("tumble-wa") ?? "").split(",").includes(String(id));
  } catch {
    return false;
  }
}

function rememberChat(id: number) {
  try {
    const ids = new Set((sessionStorage.getItem("tumble-wa") ?? "").split(",").filter(Boolean));
    ids.add(String(id));
    sessionStorage.setItem("tumble-wa", [...ids].join(","));
  } catch {
    /* the row link still works */
  }
}

function unsentFood(visit: VisitView): KotLine[] {
  return visit.lines.flatMap((line) => {
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
  bankAccount = "",
  journalScan = false,
  venueAddress,
  receiptNote,
  receiptThanks,
  receiptRules,
  printTicket = false,
  printReceipt = false,
  printPack = false,
  holdOpen = false,
  startNew = false,
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
  bankAccount?: string;
  journalScan?: boolean;
  venueAddress: string;
  receiptNote: string;
  receiptThanks: string;
  receiptRules: string;
  printTicket?: boolean;
  printReceipt?: boolean;
  printPack?: boolean;
  holdOpen?: boolean;
  startNew?: boolean;
}) {
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
  const offeredChat = useRef(new Set<number>());
  const [check, setCheck] = useState<CheckDraft | null>(startNew ? freshCheck() : null);
  const [sendCheck, setSendCheck] = useState(false);
  const [boardAt, setBoardAt] = useState(0);
  const [tab, setTab] = useState("playing");
  const router = useRouter();
  const playRate = rates.find((rate) => rate.minutes === 30) ?? rates[0] ?? null;
  const ranked = open
    .map((item) => {
      const walkIn = item.childCount === 0 && item.blocks.length === 0;
      return { item, walkIn, left: walkIn ? Number.POSITIVE_INFINITY : minutesLeft(item.paidUntil, now) };
    })
    .sort((a, b) => a.left - b.left);
  const openVisit = visit?.status === "open" ? visit : null;
  const walkIn = Boolean(openVisit && openVisit.childCount === 0 && openVisit.blocks.length === 0);
  const tickets = open
    .map((item) => (openVisit && item.id === openVisit.id ? openVisit : item))
    .filter((item) => item.childCount === 0 || item.lines.length > 0 || item.id === openVisit?.id);
  if (openVisit && !tickets.some((item) => item.id === openVisit.id)) tickets.unshift(openVisit);
  const overtime = openVisit && !walkIn ? quoteOvertime(openVisit.paidUntil, rates, now) : null;
  const due = openVisit
    ? openVisit.dueNu - (openVisit.overtime?.amountNu ?? 0) + (overtime?.amountNu ?? 0)
    : (visit?.dueNu ?? 0);
  const childrenIn = open.reduce((sum, item) => sum + (item.childCount > 0 || item.blocks.length > 0 ? item.childCount : 0), 0);
  const overdue = ranked.filter((row) => !row.walkIn && row.left < 0).length;
  const ending = ranked.filter((row) => !row.walkIn && row.left >= 0 && row.left <= 5).length;
  const lookup = (query ?? "").trim();
  const status = error || ok || (check ? "Enter moves on. Escape cancels." : openVisit ? `${walkIn ? "Walk-in" : formatPhone(openVisit.phone)} is on this till` : lookup ? `No open play card for ${lookup}` : "Alt+N starts a new family. Alt+L opens the menu.");
  const extra = overtime ? overtimeSentence(overtime) : "";
  const poleRef = useRef<PolePayload | null>(null);

  useEffect(() => {
    const checkin = tender?.kind === "checkin" ? tender : null;
    const family = check && playRate ? check : null;
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

  const lineCount = openVisit?.lines.reduce((sum, line) => sum + line.qty, 0) ?? 0;
  useEffect(() => {
    if (openVisit && (walkIn || openVisit.lines.length > 0)) setTab(openVisit.code);
    else setTab("playing");
  }, [openVisit?.code, lineCount, walkIn]);

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
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.type === "keydown" && event.key === "F7") {
        event.preventDefault();
        setMenuOpen(false);
        setRecentOpen(false);
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
        if (check) setCheck(null);
        else if (peopleOpen) setPeopleOpen(false);
        else if (askTable) setAskTable(false);
        else if (tender) setTender(null);
        else setMenuOpen(false);
      }
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (!typing && !check && !menuOpen && !recentOpen && !peopleOpen && !askTable && !tender && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        const order = ["playing", ...tickets.map((item) => item.code)];
        const index = Math.max(0, order.indexOf(tab));
        const step = event.key === "ArrowRight" ? 1 : -1;
        const next = order[(index + step + order.length) % order.length] ?? "playing";
        event.preventDefault();
        setTab(next);
        if (next !== "playing") router.push(`/cashier?q=${next}`);
        return;
      }
      if (!typing && !check && !menuOpen && !recentOpen && !peopleOpen && !askTable && !tender && tab === "playing" && ranked.length) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const current = openVisit ? ranked.findIndex((row) => row.item.id === openVisit.id) : boardAt;
          const delta = event.key === "ArrowDown" ? 1 : -1;
          const next = (Math.max(0, current) + delta + ranked.length) % ranked.length;
          setBoardAt(next);
          router.push(`/cashier?q=${ranked[next].item.code}`);
          return;
        }
        if (event.key.toLowerCase() === "w") {
          const current = openVisit ? ranked.find((row) => row.item.id === openVisit.id) : ranked[Math.min(boardAt, ranked.length - 1)];
          if (current && current.left <= 5) {
            event.preventDefault();
            window.open(whatsAppChat(current.item.phone, venueName, current.left), "_blank", "noopener");
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
  }, [tender, openVisit, recentOpen, recent, recentIndex, peopleOpen, askTable, check, menuOpen, ranked, boardAt, router, venueName, tab, tickets]);

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
    const when = formatWhen(new Date().toISOString());
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
    void saveKotAction(openVisit.id, table, fresh.map((line) => line.id)).then(() => router.refresh());
    restTickets.current = jobs.slice(1);
    setTicket(jobs[0] ?? null);
    if (!jobs[0] && due > 0) openTender();
  }

  function beginSale() {
    if (check) return;
    if (tender) {
      submitOpenTender();
      return;
    }
    if (!openVisit) {
      beginCheckIn();
      return;
    }
    if (askTable) {
      confirmTable();
      return;
    }
    setMenuOpen(false);
    setPeopleOpen(false);
    setRecentOpen(false);
    if (unsentFood(openVisit).length) {
      setTableError("");
      setAskTable(true);
      return;
    }
    if (due > 0) {
      openTender();
      return;
    }
    setCheck(freshCheck());
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
    setAskTable(false);
    setTender(null);
    setCheck(freshCheck());
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
        if (draft.step === "phone" && draft.phone.length === 8) {
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
        } else if (draft.step === "journal" && draft.journal.trim() && (draft.bank || bankFromJournal(draft.journal))) setSendCheck(true);
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
  }, [check, open]);

  useEffect(() => {
    if (!printPack || !qr) return;
    let stage: "sticker" | "receipt" | "done" = "sticker";
    const timer = window.setTimeout(() => {
      document.body.dataset.print = "sticker";
      window.print();
    }, 400);
    function done() {
      if (stage === "sticker") {
        stage = "receipt";
        document.body.dataset.print = "receipt";
        window.print();
        return;
      }
      stage = "done";
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
  }, [printPack, qr]);

  const soonestId = ranked.find((row) => row.left <= 5)?.item.id ?? 0;
  useEffect(() => {
    if (!soonestId || offeredChat.current.has(soonestId) || sessionHasChat(soonestId)) return;
    const row = ranked.find((item) => item.item.id === soonestId);
    if (!row) return;
    offeredChat.current.add(soonestId);
    rememberChat(soonestId);
    window.open(whatsAppChat(row.item.phone, venueName, row.left), "_blank", "noopener");
  }, [soonestId, venueName, ranked]);

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
        if (!next) openTender();
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
      scanAction="/cashier"
      scanDefault={query}
      inputMode="none"
      scanPlaceholder="Phone or ticket"
      dueEyebrow={visit ? (overtime ? "Extra time" : "Due") : "Playing"}
      dueValue={visit ? formatNu(due) : String(childrenIn)}
      dueHint={
        visit
          ? overtime
            ? `Stayed ${overtime.extraMinutes} min extra`
            : openVisit
              ? formatPhone(openVisit.phone)
              : "Closed"
          : overdue > 0
            ? `${overdue} overtime`
            : "children"
      }
      status={status}
      statusBad={Boolean(error || (lookup && !openVisit))}
      tools={
        <>
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
            <b>{childrenIn}</b>
            <span>In play</span>
            {overdue > 0 ? <small>{overdue} overtime</small> : ending > 0 ? <small>{ending} ending</small> : <small>Alt+H</small>}
          </button>
          {overdue > 0 && !quiet ? (
            <Button type="button" variant="outline" className="h-11" onClick={() => setQuiet(true)}>
              Quiet
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            <b className="text-foreground">{formatNu(todayNu)}</b> today · <b className="text-foreground">{formatNu(playNu)}</b> play ·{" "}
            <b className="text-foreground">{formatNu(foodNu)}</b> food
          </p>
          <Button type="button" variant={cam ? "secondary" : "outline"} className="h-11" aria-pressed={cam} onClick={() => setCam((value) => !value)}>
            Camera
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => window.open("/display", "tumble-customer", "width=1100,height=800")}>
            Screen
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={beginCheckIn}>
            New
          </Button>
          {openVisit ? (
            <Button variant="outline" className="h-11" asChild>
              <Link href={`/stickers/${openVisit.code}`}>Stickers</Link>
            </Button>
          ) : null}
          <span className="text-sm">{staffName}</span>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="h-11">
              Lock
            </Button>
          </form>
        </>
      }
    >
        {cam ? (
          <div className="border-b border-[var(--line)] bg-[var(--paper)] px-3 py-3">
            <Scanner to="/cashier" defaultOpen />
          </div>
        ) : null}

        <div className="tshong-till-body cash-stage">
          <div className="tshong-till-ticket cash-list">
            <Tabs value={tab} onValueChange={setTab} className="cash-tabs min-h-0 flex-1">
              <TabsList variant="line" className="h-11 w-full justify-start gap-1 overflow-x-auto px-3">
                <TabsTrigger value="playing">Playing</TabsTrigger>
                {tickets.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.code}
                    onClick={() => router.push(`/cashier?q=${item.code}`)}
                  >
                    {item.childCount === 0 && item.blocks.length === 0 ? "Walk-in" : formatPhone(item.phone)}
                    <Badge variant={item.lines.some((line) => !line.paid) ? "default" : "secondary"}>
                      {item.lines.reduce((sum, line) => sum + line.qty, 0) || item.childCount}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="playing" className="min-h-0 overflow-auto">
                {ranked.length ? (
                  <ul className="play-board">
                    {ranked.map((row, index) => {
                      const on = openVisit ? row.item.id === openVisit.id : index === Math.min(boardAt, ranked.length - 1);
                      const time = row.left < 0 ? "over" : row.left <= 5 ? "ending" : "ok";
                      return (
                        <li key={row.item.id}>
                          <div className="play-row" data-on={on ? "1" : "0"} data-time={time}>
                            <button
                              type="button"
                              onClick={() => {
                                setBoardAt(index);
                                setTab(row.item.lines.length > 0 || row.walkIn ? row.item.code : "playing");
                                router.push(`/cashier?q=${row.item.code}`);
                              }}
                            >
                              <b>{row.walkIn ? "Walk-in" : formatPhone(row.item.phone)}</b>
                              <em className="tabular-nums">
                                {row.walkIn
                                  ? formatNu(row.item.dueNu)
                                  : row.left < 0
                                    ? `${Math.abs(row.left)} min over`
                                    : `${row.left} min`}
                              </em>
                              <small>
                                {row.walkIn
                                  ? `${row.item.lines.reduce((sum, line) => sum + line.qty, 0)} items`
                                  : `${row.item.childCount} ${row.item.childCount === 1 ? "child" : "children"}${time === "ending" ? " · ending" : time === "over" ? " · overtime" : ""}`}
                              </small>
                            </button>
                            {!row.walkIn && row.left <= 5 ? (
                              <a className="play-wa" href={whatsAppChat(row.item.phone, venueName, row.left)} target="_blank" rel="noreferrer">
                                WhatsApp · W
                              </a>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="cash-hint">No one is playing. Alt+N checks in a family. Alt+L starts a walk-in order.</p>
                )}
              </TabsContent>
              {tickets.map((item) => (
                <TabsContent key={item.id} value={item.code} className="min-h-0 overflow-auto">
                  <BillTab visit={item} active={tab === item.code} venueName={venueName} qr={qr} />
                </TabsContent>
              ))}
            </Tabs>
          </div>
          {check && playRate ? (
            <CheckInSheet
              venueName={venueName}
              draft={check}
              rate={playRate}
              staticPayload={staticPayload}
              fieldRef={checkField}
              formRef={checkForm}
              onChange={setCheck}
            />
          ) : openVisit ? (
            <PayRail
              venueName={venueName}
              visit={openVisit}
              due={due}
              overtime={overtime}
              askTable={askTable}
              tableNo={tableNo}
              tableRef={tableRef}
              tableError={tableError}
              spots={tableSpots(open)}
              onTable={(value) => {
                setTableError("");
                setTableNo(value);
              }}
              onSale={() => saleRef.current()}
            />
          ) : (
            <ChildSheet venueName={venueName} visit={ranked[Math.min(boardAt, Math.max(0, ranked.length - 1))]?.item ?? null} />
          )}
        </div>
        {printPack && visit && qr ? (
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
        ) : null}
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
              setPeopleOpen((open) => !open);
            }}
          >
            <small>F7</small>
            <span>People</span>
          </button>
          {openVisit ? (
            <button type="button" className="tshong-fkey" onClick={() => saleRef.current()}>
              <small>Alt+S</small>
              <span>Tickets</span>
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
              onClick={() => saleRef.current()}
            >
              <small>Alt+S</small>
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
        {peopleOpen ? <HoldSheet visits={open} now={now} currentId={openVisit?.id} venue={venueName} onClose={() => setPeopleOpen(false)} /> : null}
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
          <MenuSheet menu={menu} visit={openVisit} onClose={() => setMenuOpen(false)} />
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
        <KotSlip
          venue={venueName}
          tableNo={ticket.tableNo}
          phone={openVisit.phone}
          code={openVisit.code}
          qr={qr}
          when={ticket.when}
          reprint={false}
          ticket={ticket.kind}
          lines={ticket.lines}
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
    </TillShell>
  );
}

function BillTab({ visit, active, venueName, qr }: { visit: VisitView; active: boolean; venueName: string; qr: string }) {
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
      meta: line.outlet === "cafe" ? "Cafe" : "Restaurant",
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
        else document.querySelector<HTMLFormElement>(`[data-drop-line="${line.id}"]`)?.requestSubmit();
      } else if (event.key === "-" || event.key === "Subtract") {
        event.preventDefault();
        if (line.qty - 1 < line.firedQty) setVoiding({ lineId: line.id, next: Math.max(0, line.qty - 1) });
        else document.querySelector<HTMLFormElement>(`[data-qty-line="${line.id}"][data-delta="-1"]`)?.requestSubmit();
      } else if (event.key === "Enter" || event.key === "+" || event.key === "=" || event.key === "Add") {
        event.preventDefault();
        document.querySelector<HTMLFormElement>(`[data-qty-line="${line.id}"][data-delta="1"]`)?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, at, food, voiding]);
  if (!rows.length) {
    return <p className="cash-hint">This bill is empty. Alt+L adds a dish.</p>;
  }
  return (
    <>
    <ul className="play-board">
      <li className="px-4 py-2 text-xs text-muted-foreground">Up and down choose a line. Enter adds one. Delete removes a line the kitchen has not started. A sent dish needs a manager void.</li>
      {rows.map((row) => (
        <li
          key={row.key}
          data-on={row.line && food[Math.min(at, food.length - 1)]?.id === row.line.id ? "1" : "0"}
          className="animate-in fade-in slide-in-from-left-2 flex items-center justify-between gap-3 border-b px-4 py-2 duration-300 data-[on=1]:bg-muted"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.qty ? `${row.qty} × ` : ""}
              {row.name}
            </p>
            <Badge variant="outline" className="mt-1">
              {row.meta}
              {row.paid ? " · paid" : ""}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <b className="tabular-nums">{row.paid ? "Paid" : formatNu(row.amount)}</b>
            {row.line && !row.line.paid ? (
              <>
                {row.line.qty - 1 < row.line.firedQty ? (
                  <Button type="button" size="icon-xs" variant="outline" aria-label="Remove one" onClick={() => setVoiding({ lineId: row.line!.id, next: Math.max(0, row.line!.qty - 1) })}>
                    −
                  </Button>
                ) : (
                  <LineQty visit={visit} lineId={row.line.id} outlet={row.line.outlet} delta={-1} label="−" />
                )}
                <LineQty visit={visit} lineId={row.line.id} outlet={row.line.outlet} delta={1} label="+" />
                {row.line.firedQty > 0 ? (
                  <Button type="button" size="xs" variant="outline" onClick={() => setVoiding({ lineId: row.line!.id, next: 0 })}>
                    Delete
                  </Button>
                ) : (
                  <form action={removeLineAction} data-drop-line={row.line.id}>
                    <input type="hidden" name="visitId" value={visit.id} />
                    <input type="hidden" name="lineId" value={row.line.id} />
                    <input type="hidden" name="code" value={visit.code} />
                    <input type="hidden" name="back" value="/cashier" />
                    <Button type="submit" size="xs" variant="outline">
                      Delete
                    </Button>
                  </form>
                )}
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
    <LineVoid
      visit={visit}
      venueName={venueName}
      qr={qr}
      line={visit.lines.find((line) => line.id === voiding?.lineId) ?? null}
      next={voiding?.next ?? 0}
      onClose={() => setVoiding(null)}
    />
    </>
  );
}

function LineVoid({
  visit,
  venueName,
  qr,
  line,
  next,
  onClose,
}: {
  visit: VisitView;
  venueName: string;
  qr: string;
  line: VisitView["lines"][number] | null;
  next: number;
  onClose: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [armed, setArmed] = useState(false);
  const cancelQty = line ? Math.max(0, line.firedQty - next) : 0;

  useEffect(() => {
    if (!armed || !line) return;
    document.body.dataset.print = "kot";
    const done = () => {
      delete document.body.dataset.print;
      window.removeEventListener("afterprint", done);
      formRef.current?.requestSubmit();
    };
    window.addEventListener("afterprint", done);
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [armed, line]);

  return (
    <Dialog open={line != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void a sent dish</DialogTitle>
          <DialogDescription>
            The kitchen already has this. A manager PIN voids it and prints a cancel.
          </DialogDescription>
        </DialogHeader>
        {line ? (
          <form
            ref={formRef}
            action={voidLineAction}
            className="grid gap-3"
            onSubmit={(event) => {
              const pin = String(new FormData(event.currentTarget).get("secret") ?? "").trim();
              if (cancelQty > 0 && !armed && pin) {
                event.preventDefault();
                setArmed(true);
              }
            }}
          >
            <input type="hidden" name="visitId" value={visit.id} />
            <input type="hidden" name="lineId" value={line.id} />
            <input type="hidden" name="nextQty" value={next} />
            <input type="hidden" name="code" value={visit.code} />
            <input type="hidden" name="back" value="/cashier" />
            <Field label="Manager PIN">
              <Input name="secret" type="password" inputMode="numeric" autoComplete="off" autoFocus />
            </Field>
            <Button type="submit" variant="destructive">
              Void
            </Button>
            {armed ? (
              <KotSlip
                venue={venueName}
                tableNo={visit.tableNo || "Counter"}
                phone={visit.phone}
                code={visit.code}
                qr={qr}
                when={formatWhen(new Date().toISOString())}
                reprint={false}
                cancel
                ticket={line.outlet === "cafe" ? "bot" : "kot"}
                lines={[{ name: line.name, qty: cancelQty, outlet: line.outlet, note: "Cancel" }]}
              />
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
            <p className="cash-hint">Alt+L adds food. Alt+N checks in a new family.</p>
          </>
        ) : (
          <p className="cash-hint">Alt+N checks in a family. Mobile, children, then cash or bank QR.</p>
        )}
      </div>
    </aside>
  );
}

function CheckInSheet({
  venueName,
  draft,
  rate,
  staticPayload,
  fieldRef,
  formRef,
  onChange,
}: {
  venueName: string;
  draft: CheckDraft;
  rate: Rate;
  staticPayload: string;
  fieldRef: RefObject<HTMLInputElement | null>;
  formRef: RefObject<HTMLFormElement | null>;
  onChange: (next: CheckDraft) => void;
}) {
  const count = Math.max(1, Number(draft.children) || 1);
  const amount = rate.amountNu;
  const adding = draft.step === "adding";
  const titles: Record<CheckStep, string> = {
    phone: "Mobile number",
    children: "Children",
    pay: "Pay",
    journal: "Journal number",
    adding: "More children",
  };

  return (
    <aside className="tshong-till-rail cash-paper">
      <form ref={formRef} action={adding ? addChildrenAction : checkInAction} className="cash-receipt">
        <input type="hidden" name="back" value="/cashier" />
        <input type="hidden" name="name" value="" />
        <input type="hidden" name="phone" value={draft.phone} />
        <input type="hidden" name="childCount" value={count} />
        <input type="hidden" name="minutes" value={rate.minutes} />
        <input type="hidden" name="method" value={draft.method} />
        <input type="hidden" name="journal" value={draft.journal} />
        <input type="hidden" name="payBank" value={draft.bank || bankFromJournal(draft.journal)} />
        {adding ? <input type="hidden" name="visitId" value={draft.addToId ?? ""} /> : null}
        {adding ? <input type="hidden" name="code" value={draft.addToCode ?? ""} /> : null}
        <header className="cash-receipt-head">
          <strong>{venueName}</strong>
          <span>{adding ? "Add children" : "Check in"}</span>
        </header>
        <hr className="cash-receipt-rule" />
        <p className="cash-receipt-row">
          <span>{adding ? `${draft.addToCode} · ${draft.addToCount ?? 0} already in` : `Play ${rate.minutes} min`}</span>
          <b>{adding ? "Same bill" : formatNu(amount)}</b>
        </p>
        <button type="submit" className="sr-only" tabIndex={-1}>
          Print
        </button>
        <label className="cash-field">
          <span>{titles[draft.step]}</span>
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
          {draft.step === "pay" ? <p className="cash-hint">C cash. B bank QR.</p> : null}
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
          <PayQr staticPayload={staticPayload} amountNu={amount} note={`Play ${rate.minutes}m`} compact />
        ) : null}
        <p className="cash-hint">Enter continues. Escape cancels.</p>
      </form>
    </aside>
  );
}

function MenuSheet({
  menu,
  visit,
  onClose,
}: {
  menu: MenuItem[];
  visit: VisitView | null;
  onClose: () => void;
}) {
  const [find, setFind] = useState("");
  const [at, setAt] = useState(0);
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
    const picked = document.querySelector('[data-menu-item][data-pick="1"]');
    picked?.scrollIntoView({ block: "nearest" });
  }, [at, rows]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;
      if (!rows.length) return;
      event.preventDefault();
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
  }, [rows, at]);

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
        <ul className="cash-menu-list">
          {rows.length ? null : <li className="cash-hint">No match.</li>}
          {rows.map((item) => {
            const picked = rows[Math.min(at, Math.max(rows.length - 1, 0))]?.id === item.id;
            return (
              <li key={item.id}>
                <form action={addItemAction}>
                  {visit ? <input type="hidden" name="visitId" value={visit.id} /> : null}
                  {visit ? <input type="hidden" name="code" value={visit.code} /> : null}
                  <input type="hidden" name="back" value="/cashier" />
                  <input type="hidden" name="outlet" value={item.outlet} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <button type="submit" data-menu-item={item.id} data-pick={picked ? "1" : "0"}>
                    <span>
                      {item.name}
                      <small>{item.category}</small>
                    </span>
                    <b>{formatNu(item.priceNu)}</b>
                  </button>
                </form>
              </li>
            );
          })}
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
  overtime,
  askTable,
  tableNo,
  tableRef,
  tableError,
  spots,
  onTable,
  onSale,
}: {
  venueName: string;
  visit: VisitView;
  due: number;
  overtime: ReturnType<typeof quoteOvertime>;
  askTable: boolean;
  tableNo: string;
  tableRef: RefObject<HTMLInputElement | null>;
  tableError: string;
  spots: { name: string; full: boolean }[];
  onTable: (value: string) => void;
  onSale: () => void;
}) {
  const itemCount = visit.lines.reduce((sum, line) => sum + line.qty, 0);
  const cafeNu = visit.lines.filter((line) => line.outlet === "cafe" && !line.paid).reduce((sum, line) => sum + line.amountNu, 0);
  const kitchenNu = visit.lines.filter((line) => line.outlet === "restaurant" && !line.paid).reduce((sum, line) => sum + line.amountNu, 0);
  const playNu = visit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0);
  return (
    <aside className="tshong-till-rail cash-paper">
      <div className="cash-receipt">
        <header className="cash-receipt-head">
          <strong>{venueName}</strong>
          <span>{visit.code}</span>
        </header>
        <p className="cash-receipt-row">
          <span>{visit.childCount === 0 && visit.blocks.length === 0 ? "Walk-in" : visit.guardianName || "Guest"}</span>
          <b>{visit.phone.length === 8 ? formatPhone(visit.phone) : visit.code}</b>
        </p>
        {visit.childCount > 0 || visit.blocks.length > 0 ? (
          <p className="cash-hint">
            {visit.childCount} {visit.childCount === 1 ? "child" : "children"}
            {visit.tableNo ? ` · Table ${visit.tableNo}` : ""}
          </p>
        ) : visit.tableNo ? (
          <p className="cash-hint">Table {visit.tableNo}</p>
        ) : null}
        {visit.blocks.length > 0 ? <GlowTimer end={visit.paidUntil} spanMin={playSpanMinutes(visit.blocks)} /> : null}
        <hr className="cash-receipt-rule" />
        <p className="cash-receipt-row">
          <span>Lines</span>
          <b className="tabular-nums">{visit.lines.length}</b>
        </p>
        <p className="cash-receipt-row">
          <span>Items</span>
          <b className="tabular-nums">{itemCount}</b>
        </p>
        {cafeNu > 0 ? (
          <p className="cash-receipt-row">
            <span>Bar</span>
            <b className="tabular-nums">{formatNu(cafeNu)}</b>
          </p>
        ) : null}
        {kitchenNu > 0 ? (
          <p className="cash-receipt-row">
            <span>Kitchen</span>
            <b className="tabular-nums">{formatNu(kitchenNu)}</b>
          </p>
        ) : null}
        {playNu > 0 ? (
          <p className="cash-receipt-row">
            <span>Play</span>
            <b className="tabular-nums">{formatNu(playNu)}</b>
          </p>
        ) : null}
        {overtime && overtime.amountNu > 0 ? (
          <p className="cash-receipt-row">
            <span>Extra {overtime.extraMinutes} min</span>
            <b className="tabular-nums">{formatNu(overtime.amountNu)}</b>
          </p>
        ) : null}
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
          <p className="cash-hint">{tableError || "Left and right move the tables. Type your own spot when people are standing. Enter prints the bar ticket, then the kitchen."}</p>
        ) : null}
        {overtime ? <p className="cash-hint">{overtimeSentence(overtime)}</p> : null}
        <hr className="cash-receipt-rule" />
        <p className="cash-receipt-total">
          <span>Due</span>
          <b className="tabular-nums">{formatNu(due)}</b>
        </p>
        {due > 0 || askTable ? (
          <div className="cash-go">
            <button type="button" className="cash-cash" onClick={onSale}>
              {askTable ? "Print tickets" : `Tender ${formatNu(due)}`}
            </button>
          </div>
        ) : null}
      </div>
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
    <form action={qtyAction} data-qty-line={lineId} data-delta={delta}>
      <input type="hidden" name="visitId" value={visit.id} />
      <input type="hidden" name="lineId" value={lineId} />
      <input type="hidden" name="code" value={visit.code} />
      <input type="hidden" name="back" value="/cashier" />
      <input type="hidden" name="outlet" value={outlet} />
      <input type="hidden" name="delta" value={delta} />
      <Button type="submit" size="icon-xs" variant="outline" aria-label={delta < 0 ? "Remove one" : "Add one"}>
        {label}
      </Button>
    </form>
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
