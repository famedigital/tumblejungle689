import { randomBytes } from "node:crypto";
import { db, makeSecret, putSetting, setting } from "@/lib/db";
import { toStaticEmv } from "@/lib/emv";
import { addMinutes, minutesLeft, normalizePhone, thimphuDayRange } from "@/lib/format";
import { quoteOvertime, type OvertimeQuote } from "@/lib/overtime";
import type {
  DaySummary,
  MenuItem,
  Outlet,
  PayMethod,
  PaymentRow,
  Rate,
  RecentTxn,
  Settings,
  StaffRow,
  TabLine,
  VisitView,
} from "@/lib/types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function nowIso(): string {
  return new Date().toISOString();
}

function num(value: number | bigint): number {
  return Number(value);
}

export function getSettings(): Settings {
  let rates: Rate[] = [];
  try {
    const parsed = JSON.parse(setting("rates") || "[]") as Rate[];
    rates = parsed.filter(
      (rate) =>
        Number.isFinite(rate.minutes) &&
        rate.minutes > 0 &&
        Number.isFinite(rate.amountNu) &&
        rate.amountNu >= 0,
    );
  } catch {
    rates = [];
  }
  return {
    venueName: setting("venue_name") || "Tumble Jungle",
    tagline: setting("tagline"),
    address: setting("address"),
    hours: setting("hours"),
    phone: setting("phone"),
    about: setting("about"),
    playBlurb: setting("play_blurb"),
    eatBlurb: setting("eat_blurb"),
    rates,
    ratesAreSamples: setting("rates_are_samples") === "1",
    menuIsSample: setting("menu_is_sample") === "1",
    bankPayload: setting("bank_payload"),
    bankAccount: setting("bank_account"),
    payee: setting("payee") || "Tumble Jungle",
    city: setting("city") || "Thimphu",
    showCredentialHint: setting("show_credential_hint") === "1",
    receiptNote: setting("receipt_note"),
    receiptThanks: setting("receipt_thanks") || "Thank you",
    receiptRules: setting("receipt_rules"),
  };
}

export function saveVenue(input: {
  venueName: string;
  tagline: string;
  address: string;
  hours: string;
  phone: string;
  about: string;
  playBlurb: string;
  eatBlurb: string;
}) {
  putSetting("venue_name", input.venueName.trim() || "Tumble Jungle");
  putSetting("tagline", input.tagline.trim());
  putSetting("address", input.address.trim());
  putSetting("hours", input.hours.trim());
  putSetting("phone", input.phone.trim());
  putSetting("about", input.about.trim());
  putSetting("play_blurb", input.playBlurb.trim());
  putSetting("eat_blurb", input.eatBlurb.trim());
}

export function saveReceipt(input: { note: string; thanks: string; rules: string }) {
  putSetting("receipt_note", input.note.trim());
  putSetting("receipt_thanks", input.thanks.trim() || "Thank you");
  putSetting("receipt_rules", input.rules.trim());
}

export function saveRates(rates: Rate[]) {
  const clean = rates
    .map((rate) => ({
      minutes: Math.round(rate.minutes),
      amountNu: Math.round(rate.amountNu),
    }))
    .filter((rate) => rate.minutes >= 30 && rate.minutes <= 120 && rate.amountNu >= 0);
  if (clean.length === 0) throw new Error("Add at least one play rate between 30 and 120 minutes.");
  putSetting("rates", JSON.stringify(clean));
  putSetting("rates_are_samples", "0");
}

export function saveBank(input: { payload: string; account: string; payee: string; city: string }) {
  const payload = toStaticEmv(input.payload);
  if (input.payload.trim() && !payload) throw new Error("That image is not a bank payment QR.");
  if (!payload && !input.account.replace(/\s/g, "")) throw new Error("Upload a bank QR image.");
  putSetting("bank_payload", payload);
  putSetting("bank_account", input.account.trim());
  putSetting("payee", input.payee.trim() || "Tumble Jungle");
  putSetting("city", input.city.trim() || "Thimphu");
}

export function listMenu(outlet?: Outlet, includeInactive = false): MenuItem[] {
  const rows = db()
    .prepare(
      `SELECT i.id, i.category_id, c.name AS category, c.outlet, i.name, i.price_nu, i.active
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       WHERE (? IS NULL OR c.outlet = ?)
         AND (? = 1 OR i.active = 1)
       ORDER BY c.sort, c.id, i.name`,
    )
    .all(outlet ?? null, outlet ?? null, includeInactive ? 1 : 0) as {
    id: number;
    category_id: number;
    category: string;
    outlet: Outlet;
    name: string;
    price_nu: number;
    active: number;
  }[];
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    category: row.category,
    outlet: row.outlet,
    name: row.name,
    priceNu: row.price_nu,
    active: row.active === 1,
  }));
}

export function listCategories(): { id: number; name: string; outlet: Outlet }[] {
  return db()
    .prepare("SELECT id, name, outlet FROM menu_categories ORDER BY outlet, sort, id")
    .all() as { id: number; name: string; outlet: Outlet }[];
}

export function addMenuItem(input: {
  categoryId: number;
  name: string;
  priceNu: number;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Item name is required.");
  if (!Number.isFinite(input.priceNu) || input.priceNu < 0) throw new Error("Enter a price.");
  const created = db()
    .prepare("INSERT INTO menu_items (category_id, name, price_nu, active) VALUES (?, ?, ?, 1)")
    .run(input.categoryId, name, Math.round(input.priceNu));
  putSetting("menu_is_sample", "0");
  return Number(created.lastInsertRowid);
}

export function updateMenuItem(
  id: number,
  input: { name: string; priceNu: number; active: boolean; categoryId?: number },
) {
  const name = input.name.trim();
  if (!name) throw new Error("Item name is required.");
  if (!Number.isFinite(input.priceNu) || input.priceNu < 0) throw new Error("Enter a price.");
  if (input.categoryId) {
    db()
      .prepare("UPDATE menu_items SET name = ?, price_nu = ?, active = ?, category_id = ? WHERE id = ?")
      .run(name, Math.round(input.priceNu), input.active ? 1 : 0, input.categoryId, id);
  } else {
    db()
      .prepare("UPDATE menu_items SET name = ?, price_nu = ?, active = ? WHERE id = ?")
      .run(name, Math.round(input.priceNu), input.active ? 1 : 0, id);
  }
  putSetting("menu_is_sample", "0");
}

export function catalogToday(): { dishes: Record<number, number>; play: Record<number, number> } {
  const range = thimphuDayRange();
  const dishes: Record<number, number> = {};
  const play: Record<number, number> = {};
  const food = db()
    .prepare(
      `SELECT item_id, SUM(qty) AS qty
       FROM tab_lines
       WHERE item_id IS NOT NULL AND created_at >= ? AND created_at < ?
       GROUP BY item_id`,
    )
    .all(range.start, range.end) as { item_id: number; qty: number }[];
  for (const row of food) dishes[row.item_id] = row.qty;
  const blocks = db()
    .prepare(
      `SELECT minutes, COUNT(*) AS n
       FROM play_blocks
       WHERE created_at >= ? AND created_at < ?
       GROUP BY minutes`,
    )
    .all(range.start, range.end) as { minutes: number; n: number }[];
  for (const row of blocks) play[row.minutes] = row.n;
  return { dishes, play };
}

export function addCategory(name: string, outlet: Outlet) {
  const clean = name.trim();
  if (!clean) throw new Error("Category name is required.");
  db()
    .prepare("INSERT INTO menu_categories (name, outlet, sort) VALUES (?, ?, 9)")
    .run(clean, outlet);
}

type VisitRow = {
  id: number;
  short_code: string;
  phone: string;
  guardian_name: string;
  child_count: number;
  status: "open" | "settled";
  created_at: string;
  paid_until: string;
  closed_at: string | null;
  table_no: string;
};

function hydrate(row: VisitRow): VisitView {
  const blocks = db()
    .prepare(
      `SELECT id, minutes, amount_nu, paid, prior_until, extends_to, created_at
       FROM play_blocks WHERE visit_id = ? ORDER BY id`,
    )
    .all(row.id) as {
    id: number;
    minutes: number;
    amount_nu: number;
    paid: number;
    prior_until: string;
    extends_to: string;
    created_at: string;
  }[];
  const lines = db()
    .prepare(
      `SELECT id, name, qty, unit_nu, amount_nu, outlet, paid, fired_qty
       FROM tab_lines WHERE visit_id = ? ORDER BY id`,
    )
    .all(row.id) as {
    id: number;
    name: string;
    qty: number;
    unit_nu: number;
    amount_nu: number;
    outlet: Outlet;
    paid: number;
    fired_qty: number;
  }[];
  const payments = db()
    .prepare(
      `SELECT id, kind, method, amount_nu, station, created_at
       FROM payments WHERE visit_id = ? ORDER BY id`,
    )
    .all(row.id) as {
    id: number;
    kind: string;
    method: PayMethod;
    amount_nu: number;
    station: string;
    created_at: string;
  }[];
  const mappedLines: TabLine[] = lines.map((line) => ({
    id: line.id,
    name: line.name,
    qty: line.qty,
    unitNu: line.unit_nu,
    amountNu: line.amount_nu,
    outlet: line.outlet,
    paid: line.paid === 1,
    firedQty: line.fired_qty ?? 0,
  }));
  const mappedBlocks = blocks.map((block) => ({
    id: block.id,
    minutes: block.minutes,
    amountNu: block.amount_nu,
    paid: block.paid === 1,
    priorUntil: block.prior_until,
    extendsTo: block.extends_to,
    createdAt: block.created_at,
  }));
  const overtime =
    row.status === "open" ? quoteOvertime(row.paid_until, getSettings().rates) : null;
  const dueNu =
    mappedBlocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0) +
    mappedLines.filter((line) => !line.paid).reduce((sum, line) => sum + line.amountNu, 0) +
    (overtime?.amountNu ?? 0);
  return {
    id: row.id,
    code: row.short_code,
    phone: row.phone,
    guardianName: row.guardian_name,
    childCount: row.child_count,
    status: row.status,
    createdAt: row.created_at,
    paidUntil: row.paid_until,
    closedAt: row.closed_at,
    tableNo: row.table_no ?? "",
    blocks: mappedBlocks,
    lines: mappedLines,
    payments: payments.map((payment) => ({
      id: payment.id,
      kind: payment.kind,
      method: payment.method,
      amountNu: payment.amount_nu,
      station: payment.station,
      createdAt: payment.created_at,
    })),
    dueNu,
    overtime,
  };
}

const VISIT_SQL = `
  SELECT v.id, v.short_code, g.phone, g.name AS guardian_name, v.child_count, v.status,
         v.created_at, v.paid_until, v.closed_at, v.table_no
  FROM visits v
  JOIN guardians g ON g.id = v.guardian_id
`;

export function getVisitByCode(code: string): VisitView | null {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return null;
  const row = db().prepare(`${VISIT_SQL} WHERE v.short_code = ?`).get(clean) as VisitRow | undefined;
  return row ? hydrate(row) : null;
}

export function getVisitById(id: number): VisitView | null {
  const row = db().prepare(`${VISIT_SQL} WHERE v.id = ?`).get(id) as VisitRow | undefined;
  return row ? hydrate(row) : null;
}

export function findOpenByPhone(phone: string): VisitView | null {
  const row = db()
    .prepare(`${VISIT_SQL} WHERE g.phone = ? AND v.status = 'open' ORDER BY v.id DESC`)
    .get(phone) as VisitRow | undefined;
  return row ? hydrate(row) : null;
}

export function searchVisit(query: string): VisitView | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/\/t\/([A-Za-z0-9]+)/);
  if (fromUrl) {
    const byUrl = getVisitByCode(fromUrl[1]);
    if (byUrl) return byUrl;
  }
  const byCode = getVisitByCode(trimmed);
  if (byCode) return byCode;
  const phone = normalizePhone(trimmed);
  if (!phone) return null;
  const open = findOpenByPhone(phone);
  if (open) return open;
  const row = db()
    .prepare(`${VISIT_SQL} WHERE g.phone = ? ORDER BY v.id DESC`)
    .get(phone) as VisitRow | undefined;
  return row ? hydrate(row) : null;
}

export function listOpenVisits(): VisitView[] {
  const rows = db()
    .prepare(`${VISIT_SQL} WHERE v.status = 'open' ORDER BY v.paid_until`)
    .all() as VisitRow[];
  return rows.map(hydrate);
}

function shortCode(): string {
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function rateFor(minutes: number): Rate {
  const rate = getSettings().rates.find((item) => item.minutes === minutes);
  if (!rate) throw new Error("Choose a play time from the rate card.");
  return rate;
}

export function createVisit(input: {
  phone: string;
  name: string;
  childCount: number;
  minutes: number;
  method: PayMethod;
  cashNu?: number;
  bankNu?: number;
}): VisitView {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("Enter an 8-digit phone number.");
  const children = Math.round(input.childCount);
  if (children < 1 || children > 12) throw new Error("Enter how many children are playing, from 1 to 12.");
  const existing = findOpenByPhone(phone);
  if (existing) {
    throw new Error(`This phone already has an open visit, ${existing.code}.`);
  }
  const rate = rateFor(input.minutes);
  const created = nowIso();
  const paidUntil = addMinutes(created, rate.minutes);
  const database = db();
  database.exec("BEGIN");
  try {
    const guardian = database
      .prepare("SELECT id FROM guardians WHERE phone = ?")
      .get(phone) as { id: number } | undefined;
    const guardianId = guardian
      ? guardian.id
      : num(
          database
            .prepare("INSERT INTO guardians (phone, name, created_at) VALUES (?, ?, ?)")
            .run(phone, input.name.trim(), created).lastInsertRowid,
        );
    if (guardian && input.name.trim()) {
      database.prepare("UPDATE guardians SET name = ? WHERE id = ?").run(input.name.trim(), guardianId);
    }
    let code = shortCode();
    while (database.prepare("SELECT 1 FROM visits WHERE short_code = ?").get(code)) {
      code = shortCode();
    }
    const visitId = num(
      database
        .prepare(
          `INSERT INTO visits (short_code, guardian_id, status, child_count, created_at, paid_until)
           VALUES (?, ?, 'open', ?, ?, ?)`,
        )
        .run(code, guardianId, children, created, paidUntil).lastInsertRowid,
    );
    database
      .prepare(
        `INSERT INTO play_blocks
         (visit_id, minutes, amount_nu, paid, prior_until, extends_to, created_at)
         VALUES (?, ?, ?, 1, ?, ?, ?)`,
      )
      .run(visitId, rate.minutes, rate.amountNu, created, paidUntil, created);
    const cashNu = Math.round(input.cashNu ?? (input.method === "bank_qr" ? 0 : rate.amountNu));
    const bankNu = Math.round(input.bankNu ?? (input.method === "bank_qr" ? rate.amountNu : 0));
    if (cashNu < 0 || bankNu < 0 || cashNu + bankNu !== rate.amountNu) {
      throw new Error("Cash and bank QR must add up to the play price.");
    }
    const pay = database.prepare(
      `INSERT INTO payments (visit_id, kind, method, amount_nu, station, created_at)
       VALUES (?, 'playtime', ?, ?, 'desk', ?)`,
    );
    if (cashNu > 0) pay.run(visitId, "cash", cashNu, created);
    if (bankNu > 0) pay.run(visitId, "bank_qr", bankNu, created);
    database.exec("COMMIT");
    return getVisitById(visitId)!;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function requireOpen(visitId: number): VisitView {
  const visit = getVisitById(visitId);
  if (!visit) throw new Error("Visit not found.");
  if (visit.status !== "open") throw new Error("This visit is already closed.");
  return visit;
}

export function addPlayBlock(visitId: number, minutes: number): VisitView {
  const visit = requireOpen(visitId);
  const rate = rateFor(minutes);
  const created = nowIso();
  const base = new Date(visit.paidUntil).getTime() > Date.now() ? visit.paidUntil : created;
  const extendsTo = addMinutes(base, rate.minutes);
  db()
    .prepare(
      `INSERT INTO play_blocks
       (visit_id, minutes, amount_nu, paid, prior_until, extends_to, created_at)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(visitId, rate.minutes, rate.amountNu, visit.paidUntil, extendsTo, created);
  db().prepare("UPDATE visits SET paid_until = ? WHERE id = ?").run(extendsTo, visitId);
  return getVisitById(visitId)!;
}

export function removeTabLine(lineId: number): VisitView {
  const line = db()
    .prepare("SELECT id, visit_id, paid FROM tab_lines WHERE id = ?")
    .get(lineId) as { id: number; visit_id: number; paid: number } | undefined;
  if (!line || line.paid === 1) throw new Error("That item is already paid.");
  requireOpen(line.visit_id);
  db().prepare("DELETE FROM tab_lines WHERE id = ? AND paid = 0").run(lineId);
  return getVisitById(line.visit_id)!;
}

export function cancelHold(visitId: number): VisitView {
  requireOpen(visitId);
  const database = db();
  const closed = nowIso();
  database.exec("BEGIN");
  try {
    database.prepare("DELETE FROM tab_lines WHERE visit_id = ? AND paid = 0").run(visitId);
    database.prepare("DELETE FROM play_blocks WHERE visit_id = ? AND paid = 0").run(visitId);
    const lastPaid = database
      .prepare("SELECT extends_to FROM play_blocks WHERE visit_id = ? AND paid = 1 ORDER BY id DESC LIMIT 1")
      .get(visitId) as { extends_to: string } | undefined;
    database
      .prepare("UPDATE visits SET paid_until = ?, status = 'settled', closed_at = ? WHERE id = ?")
      .run(lastPaid?.extends_to ?? closed, closed, visitId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getVisitById(visitId)!;
}

export function removeLatestUnpaidBlock(visitId: number): VisitView {
  const visit = requireOpen(visitId);
  const latest = [...visit.blocks].reverse().find((block) => !block.paid);
  if (!latest) throw new Error("There is no unpaid play block to remove.");
  if (visit.blocks[visit.blocks.length - 1]?.id !== latest.id) {
    throw new Error("Only the latest unpaid play block can be removed.");
  }
  const database = db();
  database.exec("BEGIN");
  try {
    database.prepare("DELETE FROM play_blocks WHERE id = ? AND paid = 0").run(latest.id);
    database.prepare("UPDATE visits SET paid_until = ? WHERE id = ?").run(latest.priorUntil, visitId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getVisitById(visitId)!;
}

export function addTabItem(visitId: number, itemId: number, outlet: Outlet): VisitView {
  const visit = requireOpen(visitId);
  const item = listMenu(outlet).find((row) => row.id === itemId);
  if (!item) throw new Error("That item is not on this counter.");
  const existing = visit.lines.find(
    (line) => !line.paid && line.outlet === outlet && line.name === item.name && line.unitNu === item.priceNu,
  );
  if (existing) {
    const qty = existing.qty + 1;
    db()
      .prepare("UPDATE tab_lines SET qty = ?, amount_nu = ? WHERE id = ?")
      .run(qty, qty * existing.unitNu, existing.id);
  } else {
    db()
      .prepare(
        `INSERT INTO tab_lines
         (visit_id, item_id, name, qty, unit_nu, amount_nu, outlet, paid, created_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?)`,
      )
      .run(visitId, item.id, item.name, item.priceNu, item.priceNu, outlet, nowIso());
  }
  return getVisitById(visitId)!;
}

export function saveKot(visitId: number, tableNo: string, lineIds: number[]) {
  const table = tableNo.trim().slice(0, 16);
  if (!table) throw new Error("Type the table number.");
  requireOpen(visitId);
  const database = db();
  database.prepare("UPDATE visits SET table_no = ? WHERE id = ?").run(table, visitId);
  const mark = database.prepare("UPDATE tab_lines SET fired_qty = qty WHERE visit_id = ? AND id = ?");
  for (const id of lineIds) mark.run(visitId, id);
  return getVisitById(visitId)!;
}

export function changeLineQty(lineId: number, delta: number): VisitView {
  const line = db()
    .prepare("SELECT id, visit_id, qty, unit_nu, paid FROM tab_lines WHERE id = ?")
    .get(lineId) as
    | { id: number; visit_id: number; qty: number; unit_nu: number; paid: number }
    | undefined;
  if (!line || line.paid === 1) throw new Error("That line is already paid.");
  requireOpen(line.visit_id);
  const qty = line.qty + delta;
  if (qty <= 0) {
    db().prepare("DELETE FROM tab_lines WHERE id = ?").run(lineId);
  } else {
    db()
      .prepare("UPDATE tab_lines SET qty = ?, amount_nu = ? WHERE id = ?")
      .run(qty, qty * line.unit_nu, lineId);
  }
  return getVisitById(line.visit_id)!;
}

function recordPayment(visitId: number, kind: string, method: PayMethod, amountNu: number, station: string) {
  if (amountNu <= 0) return;
  db()
    .prepare(
      `INSERT INTO payments (visit_id, kind, method, amount_nu, station, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(visitId, kind, method, amountNu, station, nowIso());
}

export function payOutlet(visitId: number, outlet: Outlet, method: PayMethod): VisitView {
  const visit = requireOpen(visitId);
  const due = visit.lines
    .filter((line) => line.outlet === outlet && !line.paid)
    .reduce((sum, line) => sum + line.amountNu, 0);
  if (due <= 0) throw new Error("Nothing to take on this counter.");
  const database = db();
  database.exec("BEGIN");
  try {
    database
      .prepare("UPDATE tab_lines SET paid = 1 WHERE visit_id = ? AND outlet = ? AND paid = 0")
      .run(visitId, outlet);
    recordPayment(visitId, "food", method, due, outlet);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getVisitById(visitId)!;
}

export function payPlayDue(visitId: number, method: PayMethod, station: string): VisitView {
  const visit = requireOpen(visitId);
  const due = visit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0);
  if (due <= 0) throw new Error("Playtime is already paid.");
  const database = db();
  database.exec("BEGIN");
  try {
    database.prepare("UPDATE play_blocks SET paid = 1 WHERE visit_id = ? AND paid = 0").run(visitId);
    recordPayment(visitId, "extension", method, due, station);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getVisitById(visitId)!;
}

export function settleVisit(visitId: number, pay: PayMethod | { cashNu: number; bankNu: number }): VisitView {
  const visit = requireOpen(visitId);
  const foodDue = visit.lines.filter((line) => !line.paid).reduce((sum, line) => sum + line.amountNu, 0);
  const playDue = visit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0);
  const quote = quoteOvertime(visit.paidUntil, getSettings().rates);
  if (quote && quote.extraMinutes > 0 && quote.blocks.length === 0) {
    throw new Error(`They stayed ${quote.extraMinutes} min past play time. Set a play rate before closing.`);
  }
  const due = foodDue + playDue + (quote?.amountNu ?? 0);
  const parts = splitParts(due, pay);
  const pot = { cash: parts.cashNu, bank: parts.bankNu };
  const database = db();
  const closed = nowIso();
  database.exec("BEGIN");
  try {
    if (foodDue > 0) {
      database.prepare("UPDATE tab_lines SET paid = 1 WHERE visit_id = ? AND paid = 0").run(visitId);
      payKind(visitId, "food", foodDue, pot);
    }
    if (playDue > 0) {
      database.prepare("UPDATE play_blocks SET paid = 1 WHERE visit_id = ? AND paid = 0").run(visitId);
      payKind(visitId, "extension", playDue, pot);
    }
    if (quote && quote.amountNu > 0) {
      recordOvertime(database, visit, quote);
      payKind(visitId, "extension", quote.amountNu, pot);
    }
    database
      .prepare("UPDATE visits SET status = 'settled', closed_at = ? WHERE id = ?")
      .run(closed, visitId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getVisitById(visitId)!;
}

function splitParts(due: number, pay: PayMethod | { cashNu: number; bankNu: number }): { cashNu: number; bankNu: number } {
  if (typeof pay === "string") {
    return pay === "bank_qr" ? { cashNu: 0, bankNu: due } : { cashNu: due, bankNu: 0 };
  }
  const cashNu = Math.round(pay.cashNu);
  const bankNu = Math.round(pay.bankNu);
  if (cashNu < 0 || bankNu < 0 || cashNu + bankNu !== due) {
    throw new Error("Cash and bank QR must add up to the amount due.");
  }
  return { cashNu, bankNu };
}

function payKind(visitId: number, kind: string, need: number, pot: { cash: number; bank: number }) {
  const cash = Math.min(pot.cash, need);
  pot.cash -= cash;
  const bank = need - cash;
  pot.bank -= bank;
  recordPayment(visitId, kind, "cash", cash, "cashier");
  recordPayment(visitId, kind, "bank_qr", bank, "cashier");
}

function recordOvertime(database: ReturnType<typeof db>, visit: VisitView, quote: OvertimeQuote) {
  let prior = visit.paidUntil;
  const created = nowIso();
  const insert = database.prepare(
    `INSERT INTO play_blocks
     (visit_id, minutes, amount_nu, paid, prior_until, extends_to, created_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)`,
  );
  for (const block of quote.blocks) {
    const extendsTo = addMinutes(prior, block.minutes);
    insert.run(visit.id, block.minutes, block.amountNu, prior, extendsTo, created);
    prior = extendsTo;
  }
  database.prepare("UPDATE visits SET paid_until = ? WHERE id = ?").run(prior, visit.id);
}

export function listRecentTransactions(limit = 40): RecentTxn[] {
  const range = thimphuDayRange();
  const rows = db()
    .prepare(
      `SELECT p.id, p.kind, p.method, p.amount_nu, p.station, p.created_at,
              v.short_code, v.status, g.phone
       FROM payments p
       JOIN visits v ON v.id = p.visit_id
       JOIN guardians g ON g.id = v.guardian_id
       WHERE p.created_at >= ? AND p.created_at < ?
       ORDER BY p.id DESC
       LIMIT ?`,
    )
    .all(range.start, range.end, limit) as {
    id: number;
    kind: string;
    method: PayMethod;
    amount_nu: number;
    station: string;
    created_at: string;
    short_code: string;
    status: "open" | "settled";
    phone: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    code: row.short_code,
    phone: row.phone,
    status: row.status,
    kind: row.kind,
    method: row.method,
    amountNu: row.amount_nu,
    station: row.station,
    createdAt: row.created_at,
  }));
}

export function daySummary(): DaySummary {
  const range = thimphuDayRange();
  const payments = db()
    .prepare(
      `SELECT id, kind, method, amount_nu, station, created_at
       FROM payments
       WHERE created_at >= ? AND created_at < ?
       ORDER BY id DESC`,
    )
    .all(range.start, range.end) as {
    id: number;
    kind: string;
    method: PayMethod;
    amount_nu: number;
    station: string;
    created_at: string;
  }[];
  const mapped: PaymentRow[] = payments.map((payment) => ({
    id: payment.id,
    kind: payment.kind,
    method: payment.method,
    amountNu: payment.amount_nu,
    station: payment.station,
    createdAt: payment.created_at,
  }));
  const openCount = (
    db().prepare("SELECT COUNT(*) AS n FROM visits WHERE status = 'open'").get() as { n: number }
  ).n;
  const settledCount = (
    db()
      .prepare(
        "SELECT COUNT(*) AS n FROM visits WHERE status = 'settled' AND closed_at >= ? AND closed_at < ?",
      )
      .get(range.start, range.end) as { n: number }
  ).n;
  return {
    key: range.key,
    playNu: mapped
      .filter((payment) => payment.kind === "playtime" || payment.kind === "extension")
      .reduce((sum, payment) => sum + payment.amountNu, 0),
    foodNu: mapped
      .filter((payment) => payment.kind === "food")
      .reduce((sum, payment) => sum + payment.amountNu, 0),
    totalNu: mapped.reduce((sum, payment) => sum + payment.amountNu, 0),
    cashNu: mapped
      .filter((payment) => payment.method === "cash")
      .reduce((sum, payment) => sum + payment.amountNu, 0),
    bankNu: mapped
      .filter((payment) => payment.method === "bank_qr")
      .reduce((sum, payment) => sum + payment.amountNu, 0),
    openCount,
    settledCount,
    payments: mapped,
  };
}

export type FloorPulse = {
  at: string;
  summary: DaySummary;
  hours: { hour: string; play: number; food: number }[];
  week: { day: string; total: number }[];
  stations: { station: string; amount: number }[];
  open: { code: string; phone: string; dueNu: number; minutes: number; children: number }[];
};

function thimphuStamp(iso: string) {
  const date = new Date(iso);
  return {
    hour: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Thimphu",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
    day: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Thimphu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date),
    weekday: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Thimphu",
      weekday: "short",
    }).format(date),
  };
}

export function floorPulse(): FloorPulse {
  const summary = daySummary();
  const hours = Array.from({ length: 14 }, (_, index) => {
    const hour = String(8 + index).padStart(2, "0");
    return { hour: `${hour}:00`, play: 0, food: 0 };
  });
  for (const payment of summary.payments) {
    const bucket = hours.find((row) => row.hour.startsWith(thimphuStamp(payment.createdAt).hour));
    if (!bucket) continue;
    if (payment.kind === "food") bucket.food += payment.amountNu;
    else bucket.play += payment.amountNu;
  }

  const today = thimphuDayRange();
  const weekStart = new Date(new Date(today.start).getTime() - 6 * 86_400_000).toISOString();
  const older = db()
    .prepare(
      `SELECT amount_nu, created_at FROM payments WHERE created_at >= ? AND created_at < ?`,
    )
    .all(weekStart, today.end) as { amount_nu: number; created_at: string }[];
  const week = Array.from({ length: 7 }, (_, index) => {
    const stamp = thimphuStamp(new Date(new Date(today.start).getTime() - (6 - index) * 86_400_000).toISOString());
    return { day: stamp.weekday, key: stamp.day, total: 0 };
  });
  for (const row of older) {
    const bucket = week.find((item) => item.key === thimphuStamp(row.created_at).day);
    if (bucket) bucket.total += row.amount_nu;
  }

  const stations = ["desk", "cafe", "restaurant", "cashier"].map((station) => ({
    station,
    amount: summary.payments
      .filter((payment) => payment.station === station)
      .reduce((sum, payment) => sum + payment.amountNu, 0),
  }));

  return {
    at: new Date().toISOString(),
    summary,
    hours,
    week: week.map(({ day, total }) => ({ day, total })),
    stations,
    open: listOpenVisits().map((visit) => ({
      code: visit.code,
      phone: visit.phone,
      dueNu: visit.dueNu,
      minutes: minutesLeft(visit.paidUntil),
      children: visit.childCount,
    })),
  };
}

export function listStaff(): StaffRow[] {
  const rows = db()
    .prepare("SELECT id, name, role, active FROM staff ORDER BY id")
    .all() as { id: number; name: string; role: StaffRow["role"]; active: number }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    active: row.active === 1,
  }));
}

export function addStaff(name: string, role: StaffRow["role"], secret: string) {
  const clean = name.trim();
  if (!clean) throw new Error("Name is required.");
  if (secret.trim().length < 4) throw new Error("Use at least 4 characters for the password or PIN.");
  db()
    .prepare("INSERT INTO staff (name, role, secret_hash, active) VALUES (?, ?, ?, 1)")
    .run(clean, role, makeSecret(secret.trim()));
  putSetting("show_credential_hint", "0");
}

export function setStaffSecret(id: number, secret: string) {
  if (secret.trim().length < 4) throw new Error("Use at least 4 characters for the password or PIN.");
  db().prepare("UPDATE staff SET secret_hash = ? WHERE id = ?").run(makeSecret(secret.trim()), id);
  putSetting("show_credential_hint", "0");
}

export function setStaffActive(id: number, active: boolean) {
  const row = db().prepare("SELECT role FROM staff WHERE id = ?").get(id) as { role: string } | undefined;
  if (!row) throw new Error("Staff not found.");
  if (!active && row.role === "admin") {
    const admins = db()
      .prepare("SELECT COUNT(*) AS n FROM staff WHERE role = 'admin' AND active = 1 AND id != ?")
      .get(id) as { n: number };
    if (admins.n === 0) throw new Error("Keep at least one active admin.");
  }
  db().prepare("UPDATE staff SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
}
