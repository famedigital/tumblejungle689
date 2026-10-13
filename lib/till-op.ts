import { addMinutes } from "@/lib/format";
import { quoteOvertime } from "@/lib/overtime";
import type { MenuItem, Outlet, PayMethod, PaymentRow, Rate, TabLine, VisitView } from "@/lib/types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type TillPay = "cash" | "bank_qr" | "split";

export type TillOp = {
  id: string;
  at: string;
  visitKey: string;
} & (
  | { kind: "addItem"; lineKey: string; itemId: number; outlet: Outlet; code?: string }
  | { kind: "qty"; lineKey: string; delta: number }
  | { kind: "removeLine"; lineKey: string }
  | {
      kind: "checkIn";
      code: string;
      phone: string;
      name: string;
      childCount: number;
      minutes: number;
      method: PayMethod;
      journal: string;
      payBank: string;
      cashNu?: number;
      bankNu?: number;
    }
  | { kind: "addChildren"; childCount: number }
  | { kind: "addPlay"; minutes: number }
  | { kind: "removePlay" }
  | { kind: "saveKot"; tableNo: string; lineKeys: string[] }
  | { kind: "leave" }
  | { kind: "cancel" }
  | { kind: "waive"; secret: string }
  | { kind: "voidVisit"; secret: string }
  | { kind: "voidLine"; lineKey: string; nextQty: number; secret: string }
  | { kind: "settle"; method: TillPay; journal: string; payBank: string; cashNu?: number; bankNu?: number }
);

export function localCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export function visitKey(visit: VisitView): string {
  return visit.clientKey || `server:${visit.id}`;
}

export function lineKeyOf(line: TabLine): string {
  return line.lineKey || `line:${line.id}`;
}

export function applyOps(visits: VisitView[], ops: TillOp[], menu: MenuItem[], rates: Rate[]): VisitView[] {
  let next = visits.map(cloneVisit);
  for (const op of ops) next = applyOne(next, op, menu, rates);
  return next;
}

function applyOne(visits: VisitView[], op: TillOp, menu: MenuItem[], rates: Rate[]): VisitView[] {
  if (op.kind === "checkIn") {
    const phone = op.phone.replace(/\D/g, "");
    const existing = visits.find((visit) => visit.status === "open" && visit.phone === phone);
    if (existing) throw new Error(`This phone already has an open visit, ${existing.code}.`);
    return [...visits, checkIn(op, rates)];
  }
  if (op.kind === "addItem" && !visits.some((visit) => visitKey(visit) === op.visitKey)) {
    return [...visits, walkIn(op, menu)];
  }
  return visits.map((visit) => (visitKey(visit) === op.visitKey ? change(visit, op, menu, rates) : visit));
}

function change(visit: VisitView, op: TillOp, menu: MenuItem[], rates: Rate[]): VisitView {
  if (visit.status !== "open") throw new Error("This visit is already closed.");
  if (op.kind === "addItem") return price(addLine(visit, op, menu), rates);
  if (op.kind === "qty") return price(qty(visit, op.lineKey, op.delta), rates);
  if (op.kind === "removeLine") return price(dropLine(visit, op.lineKey), rates);
  if (op.kind === "addChildren") {
    const more = Math.round(op.childCount);
    if (more < 1) throw new Error("Enter how many more children are playing.");
    const next = visit.childCount + more;
    if (next > 12) throw new Error("A visit can hold up to 12 children.");
    return price({ ...visit, childCount: next }, rates);
  }
  if (op.kind === "addPlay") return price(addPlay(visit, op.minutes, op.at, rates), rates);
  if (op.kind === "removePlay") return price(removePlay(visit), rates);
  if (op.kind === "saveKot") return price(saveKot(visit, op.tableNo, op.lineKeys), rates);
  if (op.kind === "voidLine") return price(voidLine(visit, op.lineKey, op.nextQty), rates);
  if (op.kind === "settle") return settle(visit, op, rates);
  if (op.kind === "leave" || op.kind === "cancel" || op.kind === "waive" || op.kind === "voidVisit") {
    return { ...visit, status: "settled", closedAt: op.at, dueNu: 0, overtime: null };
  }
  return visit;
}

function checkIn(op: Extract<TillOp, { kind: "checkIn" }>, rates: Rate[]): VisitView {
  const phone = op.phone.replace(/\D/g, "");
  if (phone.length !== 8) throw new Error("Enter an 8-digit phone number.");
  const children = Math.round(op.childCount);
  if (children < 1 || children > 12) throw new Error("Enter how many children are playing, from 1 to 12.");
  const rate = rates.find((item) => item.minutes === op.minutes);
  if (!rate) throw new Error("Choose a play time from the rate card.");
  const paidUntil = addMinutes(op.at, rate.minutes);
  const visit: VisitView = {
    id: tempId(op.visitKey),
    clientKey: op.visitKey,
    code: op.code,
    phone,
    guardianName: op.name.trim(),
    childCount: children,
    status: "open",
    createdAt: op.at,
    paidUntil,
    closedAt: null,
    tableNo: "",
    blocks: [
      {
        id: tempId(`${op.visitKey}:play`),
        minutes: rate.minutes,
        amountNu: rate.amountNu,
        paid: true,
        priorUntil: op.at,
        extendsTo: paidUntil,
        createdAt: op.at,
      },
    ],
    lines: [],
    payments: money(tempId(`${op.visitKey}:pay`), "playtime", rate.amountNu, op),
    dueNu: 0,
    overtime: null,
  };
  return price(visit, rates);
}

function walkIn(op: Extract<TillOp, { kind: "addItem" }>, menu: MenuItem[]): VisitView {
  const item = menu.find((row) => row.id === op.itemId && row.outlet === op.outlet);
  if (!item) throw new Error("That item is not on this counter.");
  const code = op.code || "WALKIN";
  return {
    id: tempId(op.visitKey),
    clientKey: op.visitKey,
    code,
    phone: `F${code}`,
    guardianName: "Walk-in",
    childCount: 0,
    status: "open",
    createdAt: op.at,
    paidUntil: op.at,
    closedAt: null,
    tableNo: "",
    blocks: [],
    lines: [freshLine(op.lineKey, item.name, item.priceNu, item.outlet)],
    payments: [],
    dueNu: item.priceNu,
    overtime: null,
  };
}

function addLine(visit: VisitView, op: Extract<TillOp, { kind: "addItem" }>, menu: MenuItem[]): VisitView {
  const item = menu.find((row) => row.id === op.itemId && row.outlet === op.outlet);
  if (!item) throw new Error("That item is not on this counter.");
  const existing = visit.lines.find(
    (line) => !line.paid && line.outlet === item.outlet && line.name === item.name && line.unitNu === item.priceNu,
  );
  if (existing) {
    const qty = existing.qty + 1;
    return {
      ...visit,
      lines: visit.lines.map((line) => (line === existing ? { ...line, qty, amountNu: qty * line.unitNu } : line)),
    };
  }
  return { ...visit, lines: [...visit.lines, freshLine(op.lineKey, item.name, item.priceNu, item.outlet)] };
}

function qty(visit: VisitView, key: string, delta: number): VisitView {
  const line = visit.lines.find((item) => lineKeyOf(item) === key);
  if (!line || line.paid) throw new Error("That line is already paid.");
  const next = line.qty + delta;
  if (next < line.firedQty) throw new Error("The kitchen already has this dish. A manager can void it.");
  if (next <= 0) return { ...visit, lines: visit.lines.filter((item) => lineKeyOf(item) !== key) };
  return {
    ...visit,
    lines: visit.lines.map((item) => (lineKeyOf(item) === key ? { ...item, qty: next, amountNu: next * item.unitNu } : item)),
  };
}

function dropLine(visit: VisitView, key: string): VisitView {
  const line = visit.lines.find((item) => lineKeyOf(item) === key);
  if (!line || line.paid) throw new Error("That item is already paid.");
  if (line.firedQty > 0) throw new Error("The kitchen already has this dish. A manager can void it.");
  return { ...visit, lines: visit.lines.filter((item) => lineKeyOf(item) !== key) };
}

function voidLine(visit: VisitView, key: string, nextQty: number): VisitView {
  const line = visit.lines.find((item) => lineKeyOf(item) === key);
  if (!line || line.paid) throw new Error("That item is already paid.");
  const next = Math.max(0, Math.round(nextQty));
  if (next >= line.firedQty) throw new Error("That quantity has not reached the kitchen.");
  if (next <= 0) return { ...visit, lines: visit.lines.filter((item) => lineKeyOf(item) !== key) };
  return {
    ...visit,
    lines: visit.lines.map((item) =>
      lineKeyOf(item) === key ? { ...item, qty: next, amountNu: next * item.unitNu, firedQty: next } : item,
    ),
  };
}

function addPlay(visit: VisitView, minutes: number, at: string, rates: Rate[]): VisitView {
  const rate = rates.find((item) => item.minutes === minutes);
  if (!rate) throw new Error("Choose a play time from the rate card.");
  const base = new Date(visit.paidUntil).getTime() > new Date(at).getTime() ? visit.paidUntil : at;
  const extendsTo = addMinutes(base, rate.minutes);
  return {
    ...visit,
    paidUntil: extendsTo,
    blocks: [
      ...visit.blocks,
      {
        id: tempId(`${visitKey(visit)}:${at}:${minutes}`),
        minutes: rate.minutes,
        amountNu: rate.amountNu,
        paid: false,
        priorUntil: visit.paidUntil,
        extendsTo,
        createdAt: at,
      },
    ],
  };
}

function removePlay(visit: VisitView): VisitView {
  const latest = [...visit.blocks].reverse().find((block) => !block.paid);
  if (!latest) throw new Error("There is no unpaid play block to remove.");
  return {
    ...visit,
    paidUntil: latest.priorUntil,
    blocks: visit.blocks.filter((block) => block.id !== latest.id),
  };
}

function saveKot(visit: VisitView, tableNo: string, keys: string[]): VisitView {
  const table = tableNo.trim().slice(0, 16);
  if (!table) throw new Error("Type the table number.");
  const wanted = new Set(keys);
  return {
    ...visit,
    tableNo: table,
    lines: visit.lines.map((line) => (wanted.has(lineKeyOf(line)) ? { ...line, firedQty: line.qty } : line)),
  };
}

function settle(visit: VisitView, op: Extract<TillOp, { kind: "settle" }>, rates: Rate[]): VisitView {
  const due = price(visit, rates).dueNu;
  return {
    ...visit,
    status: "settled",
    closedAt: op.at,
    dueNu: 0,
    overtime: null,
    lines: visit.lines.map((line) => ({ ...line, paid: true })),
    blocks: visit.blocks.map((block) => ({ ...block, paid: true })),
    payments: [...visit.payments, ...money(tempId(`${op.id}:pay`), "settle", due, op)],
  };
}

function money(
  id: number,
  kind: string,
  amount: number,
  op: { at: string; method: PayMethod | TillPay; journal: string; payBank: string; cashNu?: number; bankNu?: number },
): PaymentRow[] {
  const cash = op.method === "bank_qr" ? 0 : op.method === "split" ? Math.round(op.cashNu ?? 0) : amount;
  const bank = op.method === "cash" ? 0 : op.method === "split" ? Math.round(op.bankNu ?? 0) : amount;
  const rows: PaymentRow[] = [];
  if (cash > 0) {
    rows.push({ id, kind, method: "cash", amountNu: cash, station: "cashier", createdAt: op.at });
  }
  if (bank > 0) {
    rows.push({
      id: id - 1,
      kind,
      method: "bank_qr",
      amountNu: bank,
      station: "cashier",
      createdAt: op.at,
      journalRef: op.journal,
      payBank: op.payBank,
    });
  }
  return rows;
}

function freshLine(key: string, name: string, price: number, outlet: Outlet): TabLine {
  return {
    id: tempId(key),
    lineKey: key,
    name,
    qty: 1,
    unitNu: price,
    amountNu: price,
    outlet,
    paid: false,
    firedQty: 0,
  };
}

function price(visit: VisitView, rates: Rate[]): VisitView {
  const play = visit.childCount > 0 || visit.blocks.length > 0;
  const overtime = visit.status === "open" && play && visit.blocks.length > 0 ? quoteOvertime(visit.paidUntil, rates) : null;
  const dueNu =
    visit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0) +
    visit.lines.filter((line) => !line.paid).reduce((sum, line) => sum + line.amountNu, 0) +
    (overtime?.amountNu ?? 0);
  return { ...visit, overtime, dueNu };
}

function cloneVisit(visit: VisitView): VisitView {
  return {
    ...visit,
    blocks: visit.blocks.map((block) => ({ ...block })),
    lines: visit.lines.map((line) => ({ ...line })),
    payments: visit.payments.map((payment) => ({ ...payment })),
    overtime: visit.overtime ? { ...visit.overtime, blocks: visit.overtime.blocks.map((block) => ({ ...block })) } : null,
  };
}

function tempId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash, 33) + key.charCodeAt(i);
  const id = Math.abs(hash);
  return -(id || 1);
}
