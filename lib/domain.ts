import { randomBytes } from "node:crypto";
import { ensureJournalColumn, ensureTillEvents, ensureTillSync, makeSecret, putSetting, query, tx, type Query } from "@/lib/db";
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
  TillActor,
  VisitView,
} from "@/lib/types";
import { bankFromJournal, knownBank } from "@/lib/pay-banks";
import { canFloorDrop, canLeaveOnTime, isPlayVisit, playIsOvertime, unpaidFood, unpaidPlay } from "@/lib/visit-rules";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function nowIso(): string {
  return new Date().toISOString();
}

export async function getSettings(): Promise<Settings> {
  await ensureJournalColumn();
  const rows = await query().many<{ key: string; value: string }>("SELECT key, value FROM settings");
  const bag = new Map(rows.map((row) => [row.key, row.value]));
  const read = (key: string) => bag.get(key) ?? "";
  let rates: Rate[] = [];
  try {
    const parsed = JSON.parse(read("rates") || "[]") as Rate[];
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
    venueName: read("venue_name") || "Tumble Jungle",
    tagline: read("tagline"),
    address: read("address"),
    hours: read("hours"),
    phone: read("phone"),
    about: read("about"),
    playBlurb: read("play_blurb"),
    eatBlurb: read("eat_blurb"),
    rates,
    ratesAreSamples: read("rates_are_samples") === "1",
    menuIsSample: read("menu_is_sample") === "1",
    bankPayload: read("bank_payload"),
    bankAccount: read("bank_account"),
    payee: read("payee") || "Tumble Jungle",
    city: read("city") || "Thimphu",
    showCredentialHint: read("show_credential_hint") === "1",
    receiptNote: read("receipt_note"),
    receiptThanks: read("receipt_thanks") || "Thank you",
    receiptRules: read("receipt_rules"),
    journalScan: read("journal_scan") === "1",
  };
}

export async function saveVenue(input: {
  venueName: string;
  tagline: string;
  address: string;
  hours: string;
  phone: string;
  about: string;
  playBlurb: string;
  eatBlurb: string;
}) {
  await putSetting("venue_name", input.venueName.trim() || "Tumble Jungle");
  await putSetting("tagline", input.tagline.trim());
  await putSetting("address", input.address.trim());
  await putSetting("hours", input.hours.trim());
  await putSetting("phone", input.phone.trim());
  await putSetting("about", input.about.trim());
  await putSetting("play_blurb", input.playBlurb.trim());
  await putSetting("eat_blurb", input.eatBlurb.trim());
}

export async function saveReceipt(input: { note: string; thanks: string; rules: string }) {
  await putSetting("receipt_note", input.note.trim());
  await putSetting("receipt_thanks", input.thanks.trim() || "Thank you");
  await putSetting("receipt_rules", input.rules.trim());
}

export async function saveRates(rates: Rate[]) {
  const clean = rates
    .map((rate) => ({
      minutes: Math.round(rate.minutes),
      amountNu: Math.round(rate.amountNu),
    }))
    .filter((rate) => rate.minutes >= 30 && rate.minutes <= 120 && rate.amountNu >= 0);
  if (clean.length === 0) throw new Error("Add at least one play rate between 30 and 120 minutes.");
  await putSetting("rates", JSON.stringify(clean));
  await putSetting("rates_are_samples", "0");
}

export async function saveBank(input: { payload: string; account: string; payee: string; city: string }) {
  const payload = toStaticEmv(input.payload);
  if (input.payload.trim() && !payload) throw new Error("That image is not a bank payment QR.");
  if (!payload && !input.account.replace(/\s/g, "")) throw new Error("Upload a bank QR image.");
  await putSetting("bank_payload", payload);
  await putSetting("bank_account", input.account.trim());
  await putSetting("payee", input.payee.trim() || "Tumble Jungle");
  await putSetting("city", input.city.trim() || "Thimphu");
}

export async function saveJournalScan(enabled: boolean) {
  await putSetting("journal_scan", enabled ? "1" : "0");
}

export async function listMenu(outlet?: Outlet, includeInactive = false): Promise<MenuItem[]> {
  const rows = await query().many<{
    id: number;
    category_id: number;
    category: string;
    outlet: Outlet;
    name: string;
    price_nu: number;
    active: number;
  }>(
    `SELECT i.id, i.category_id, c.name AS category, c.outlet, i.name, i.price_nu, i.active
     FROM menu_items i
     JOIN menu_categories c ON c.id = i.category_id
     WHERE (?::text IS NULL OR c.outlet = ?)
       AND (? = 1 OR i.active = 1)
     ORDER BY c.sort, c.id, i.name`,
    [outlet ?? null, outlet ?? null, includeInactive ? 1 : 0],
  );
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

export async function listCategories(): Promise<{ id: number; name: string; outlet: Outlet }[]> {
  return query().many<{ id: number; name: string; outlet: Outlet }>(
    "SELECT id, name, outlet FROM menu_categories ORDER BY outlet, sort, id",
  );
}

export async function addMenuItem(input: { categoryId: number; name: string; priceNu: number }) {
  const name = input.name.trim();
  if (!name) throw new Error("Item name is required.");
  if (!Number.isFinite(input.priceNu) || input.priceNu < 0) throw new Error("Enter a price.");
  const id = await query().insert(
    "INSERT INTO menu_items (category_id, name, price_nu, active) VALUES (?, ?, ?, 1)",
    [input.categoryId, name, Math.round(input.priceNu)],
  );
  await putSetting("menu_is_sample", "0");
  return id;
}

export async function updateMenuItem(
  id: number,
  input: { name: string; priceNu: number; active: boolean; categoryId?: number },
) {
  const name = input.name.trim();
  if (!name) throw new Error("Item name is required.");
  if (!Number.isFinite(input.priceNu) || input.priceNu < 0) throw new Error("Enter a price.");
  if (input.categoryId) {
    await query().exec(
      "UPDATE menu_items SET name = ?, price_nu = ?, active = ?, category_id = ? WHERE id = ?",
      [name, Math.round(input.priceNu), input.active ? 1 : 0, input.categoryId, id],
    );
  } else {
    await query().exec("UPDATE menu_items SET name = ?, price_nu = ?, active = ? WHERE id = ?", [
      name,
      Math.round(input.priceNu),
      input.active ? 1 : 0,
      id,
    ]);
  }
  await putSetting("menu_is_sample", "0");
}

export async function catalogToday(): Promise<{ dishes: Record<number, number>; play: Record<number, number> }> {
  const range = thimphuDayRange();
  const dishes: Record<number, number> = {};
  const play: Record<number, number> = {};
  const food = await query().many<{ item_id: number; qty: number }>(
    `SELECT item_id, SUM(qty) AS qty
     FROM tab_lines
     WHERE item_id IS NOT NULL AND created_at >= ? AND created_at < ?
     GROUP BY item_id`,
    [range.start, range.end],
  );
  for (const row of food) dishes[row.item_id] = Number(row.qty);
  const blocks = await query().many<{ minutes: number; n: number }>(
    `SELECT minutes, COUNT(*) AS n
     FROM play_blocks
     WHERE created_at >= ? AND created_at < ?
     GROUP BY minutes`,
    [range.start, range.end],
  );
  for (const row of blocks) play[row.minutes] = Number(row.n);
  return { dishes, play };
}

export async function addCategory(name: string, outlet: Outlet) {
  const clean = name.trim();
  if (!clean) throw new Error("Category name is required.");
  await query().exec("INSERT INTO menu_categories (name, outlet, sort) VALUES (?, ?, 9)", [clean, outlet]);
}

type VisitRow = {
  id: number;
  client_key: string | null;
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

type BlockRow = {
  visit_id: number;
  id: number;
  minutes: number;
  amount_nu: number;
  paid: number;
  prior_until: string;
  extends_to: string;
  created_at: string;
};

type LineRow = {
  visit_id: number;
  id: number;
  client_key: string | null;
  name: string;
  qty: number;
  unit_nu: number;
  amount_nu: number;
  outlet: Outlet;
  paid: number;
  fired_qty: number;
};

type PayRow = {
  visit_id: number;
  id: number;
  kind: string;
  method: PayMethod;
  amount_nu: number;
  station: string;
  created_at: string;
  journal_ref: string | null;
  pay_bank: string | null;
};

function grouped<T extends { visit_id: number }>(rows: T[]) {
  const bags = new Map<number, T[]>();
  for (const row of rows) {
    const list = bags.get(row.visit_id);
    if (list) list.push(row);
    else bags.set(row.visit_id, [row]);
  }
  return bags;
}

async function hydrateMany(rows: VisitRow[]): Promise<VisitView[]> {
  if (!rows.length) return [];
  await ensureTillSync();
  await ensureJournalColumn();
  const ids = rows.map((row) => row.id);
  const marks = ids.map(() => "?").join(", ");
  const [blocks, lines, payments, settings] = await Promise.all([
    query().many<BlockRow>(
      `SELECT visit_id, id, minutes, amount_nu, paid, prior_until, extends_to, created_at
       FROM play_blocks WHERE visit_id IN (${marks}) ORDER BY id`,
      ids,
    ),
    query().many<LineRow>(
      `SELECT visit_id, id, client_key, name, qty, unit_nu, amount_nu, outlet, paid, fired_qty
       FROM tab_lines WHERE visit_id IN (${marks}) ORDER BY id`,
      ids,
    ),
    query().many<PayRow>(
      `SELECT visit_id, id, kind, method, amount_nu, station, created_at, journal_ref, pay_bank
       FROM payments WHERE visit_id IN (${marks}) ORDER BY id`,
      ids,
    ),
    rows.some((row) => row.status === "open") ? getSettings() : Promise.resolve(null),
  ]);
  const blockBag = grouped(blocks);
  const lineBag = grouped(lines);
  const payBag = grouped(payments);
  return rows.map((row) => toVisit(row, blockBag.get(row.id) ?? [], lineBag.get(row.id) ?? [], payBag.get(row.id) ?? [], settings?.rates ?? null));
}

async function hydrate(row: VisitRow): Promise<VisitView> {
  const [view] = await hydrateMany([row]);
  return view!;
}

function toVisit(row: VisitRow, blocks: BlockRow[], lines: LineRow[], payments: PayRow[], rates: Rate[] | null): VisitView {
  const mappedLines: TabLine[] = lines.map((line) => ({
    id: line.id,
    lineKey: line.client_key || `line:${line.id}`,
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
  const overtime = row.status === "open" && rates && mappedBlocks.length > 0 ? quoteOvertime(row.paid_until, rates) : null;
  const dueNu =
    mappedBlocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0) +
    mappedLines.filter((line) => !line.paid).reduce((sum, line) => sum + line.amountNu, 0) +
    (overtime?.amountNu ?? 0);
  return {
    id: row.id,
    clientKey: row.client_key || `server:${row.id}`,
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
      journalRef: payment.journal_ref ?? "",
      payBank: payment.pay_bank ?? "",
    })),
    dueNu,
    overtime,
  };
}

const VISIT_SQL = `
  SELECT v.id, v.client_key, v.short_code, g.phone, g.name AS guardian_name, v.child_count, v.status,
         v.created_at, v.paid_until, v.closed_at, v.table_no
  FROM visits v
  JOIN guardians g ON g.id = v.guardian_id
`;

export async function getVisitByCode(code: string): Promise<VisitView | null> {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return null;
  const row = await query().one<VisitRow>(`${VISIT_SQL} WHERE v.short_code = ?`, [clean]);
  return row ? hydrate(row) : null;
}

export async function getVisitById(id: number): Promise<VisitView | null> {
  const row = await query().one<VisitRow>(`${VISIT_SQL} WHERE v.id = ?`, [id]);
  return row ? hydrate(row) : null;
}

export async function findOpenByPhone(phone: string): Promise<VisitView | null> {
  const row = await query().one<VisitRow>(
    `${VISIT_SQL} WHERE g.phone = ? AND v.status = 'open' ORDER BY v.id DESC`,
    [phone],
  );
  return row ? hydrate(row) : null;
}

export async function searchVisit(term: string): Promise<VisitView | null> {
  const trimmed = term.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/\/t\/([A-Za-z0-9]+)/);
  if (fromUrl) {
    const byUrl = await getVisitByCode(fromUrl[1]);
    if (byUrl) return byUrl;
  }
  const byCode = await getVisitByCode(trimmed);
  if (byCode) return byCode;
  const phone = normalizePhone(trimmed);
  if (!phone) return null;
  const open = await findOpenByPhone(phone);
  if (open) return open;
  const row = await query().one<VisitRow>(`${VISIT_SQL} WHERE g.phone = ? ORDER BY v.id DESC`, [phone]);
  return row ? hydrate(row) : null;
}

export async function listOpenVisits(): Promise<VisitView[]> {
  const rows = await query().many<VisitRow>(`${VISIT_SQL} WHERE v.status = 'open' ORDER BY v.paid_until`);
  return hydrateMany(rows);
}

function shortCode(): string {
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

async function rateFor(minutes: number): Promise<Rate> {
  const settings = await getSettings();
  const rate = settings.rates.find((item) => item.minutes === minutes);
  if (!rate) throw new Error("Choose a play time from the rate card.");
  return rate;
}

export async function createVisit(input: {
  phone: string;
  name: string;
  childCount: number;
  minutes: number;
  method: PayMethod;
  cashNu?: number;
  bankNu?: number;
  station?: string;
  journal?: string;
  payBank?: string;
  code?: string;
  clientKey?: string;
}): Promise<VisitView> {
  await ensureTillSync();
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("Enter an 8-digit phone number.");
  const children = Math.round(input.childCount);
  if (children < 1 || children > 12) throw new Error("Enter how many children are playing, from 1 to 12.");
  const existing = await findOpenByPhone(phone);
  if (existing) {
    throw new Error(`This phone already has an open visit, ${existing.code}.`);
  }
  const rate = await rateFor(input.minutes);
  const created = nowIso();
  const paidUntil = addMinutes(created, rate.minutes);
  const station = input.station === "cashier" ? "cashier" : "desk";
  const journal = (input.journal ?? "").trim();
  const visitId = await tx(async (database) => {
    const guardian = await database.one<{ id: number }>("SELECT id FROM guardians WHERE phone = ?", [phone]);
    const guardianId = guardian
      ? guardian.id
      : await database.insert("INSERT INTO guardians (phone, name, created_at) VALUES (?, ?, ?)", [
          phone,
          input.name.trim(),
          created,
        ]);
    if (guardian && input.name.trim()) {
      await database.exec("UPDATE guardians SET name = ? WHERE id = ?", [input.name.trim(), guardianId]);
    }
    const wanted = (input.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    let code = wanted.length >= 4 ? wanted : shortCode();
    while (await database.one("SELECT 1 FROM visits WHERE short_code = ?", [code])) {
      code = shortCode();
    }
    const createdVisit = await database.insert(
      `INSERT INTO visits (short_code, guardian_id, status, child_count, created_at, paid_until)
       VALUES (?, ?, 'open', ?, ?, ?)`,
      [code, guardianId, children, created, paidUntil],
    );
    await database.exec(
      `INSERT INTO play_blocks
       (visit_id, minutes, amount_nu, paid, prior_until, extends_to, created_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [createdVisit, rate.minutes, rate.amountNu, created, paidUntil, created],
    );
    const cashNu = Math.round(input.cashNu ?? (input.method === "bank_qr" ? 0 : rate.amountNu));
    const bankNu = Math.round(input.bankNu ?? (input.method === "bank_qr" ? rate.amountNu : 0));
    if (cashNu < 0 || bankNu < 0 || cashNu + bankNu !== rate.amountNu) {
      throw new Error("Cash and bank QR must add up to the play price.");
    }
    await recordPayment(database, createdVisit, "playtime", "cash", cashNu, station);
    await recordPayment(database, createdVisit, "playtime", "bank_qr", bankNu, station, journal, input.payBank ?? "");
    return createdVisit;
  });
  if (input.clientKey) {
    await query().exec("UPDATE visits SET client_key = ? WHERE id = ? AND client_key IS NULL", [input.clientKey, visitId]);
  }
  return (await getVisitById(visitId))!;
}

async function requireOpen(visitId: number): Promise<VisitView> {
  const visit = await getVisitById(visitId);
  if (!visit) throw new Error("Visit not found.");
  if (visit.status !== "open") throw new Error("This visit is already closed.");
  return visit;
}

export async function addPlayBlock(visitId: number, minutes: number): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  const rate = await rateFor(minutes);
  const created = nowIso();
  const base = new Date(visit.paidUntil).getTime() > Date.now() ? visit.paidUntil : created;
  const extendsTo = addMinutes(base, rate.minutes);
  await query().exec(
    `INSERT INTO play_blocks
     (visit_id, minutes, amount_nu, paid, prior_until, extends_to, created_at)
     VALUES (?, ?, ?, 0, ?, ?, ?)`,
    [visitId, rate.minutes, rate.amountNu, visit.paidUntil, extendsTo, created],
  );
  await query().exec("UPDATE visits SET paid_until = ? WHERE id = ?", [extendsTo, visitId]);
  return (await getVisitById(visitId))!;
}

export async function removeTabLine(lineId: number): Promise<VisitView> {
  const line = await query().one<{ id: number; visit_id: number; paid: number; fired_qty: number }>(
    "SELECT id, visit_id, paid, fired_qty FROM tab_lines WHERE id = ?",
    [lineId],
  );
  if (!line || line.paid === 1) throw new Error("That item is already paid.");
  if ((line.fired_qty ?? 0) > 0) throw new Error("The kitchen already has this dish. A manager can void it.");
  await requireOpen(line.visit_id);
  await query().exec("DELETE FROM tab_lines WHERE id = ? AND paid = 0 AND fired_qty = 0", [lineId]);
  return (await getVisitById(line.visit_id))!;
}

export async function addChildren(visitId: number, extra: number): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  if (!isPlayVisit(visit)) throw new Error("This bill is not a play visit.");
  const more = Math.round(extra);
  if (more < 1) throw new Error("Enter how many more children are playing.");
  const next = visit.childCount + more;
  if (next > 12) throw new Error("A visit can hold up to 12 children.");
  await query().exec("UPDATE visits SET child_count = ? WHERE id = ?", [next, visitId]);
  return (await getVisitById(visitId))!;
}

async function writeTillEvent(
  database: Query,
  visit: VisitView,
  actor: TillActor,
  kind: string,
  amountNu: number,
  note = "",
) {
  await ensureTillEvents();
  await database.exec(
    `INSERT INTO till_events
     (visit_id, code, phone, staff_id, staff_name, kind, amount_nu, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [visit.id, visit.code, visit.phone, actor.id, actor.name, kind, Math.max(0, Math.round(amountNu)), note, nowIso()],
  );
}

async function closeVisit(database: Query, visitId: number) {
  const closed = nowIso();
  const lastPaid = await database.one<{ extends_to: string }>(
    "SELECT extends_to FROM play_blocks WHERE visit_id = ? AND paid = 1 ORDER BY id DESC LIMIT 1",
    [visitId],
  );
  await database.exec("UPDATE visits SET paid_until = ?, status = 'settled', closed_at = ? WHERE id = ?", [
    lastPaid?.extends_to ?? closed,
    closed,
    visitId,
  ]);
}

export async function leaveOnTime(visitId: number, actor: TillActor): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  if (!canLeaveOnTime(visit)) throw new Error("Take payment before they leave, or ask a manager to void the bill.");
  await tx(async (database) => {
    await writeTillEvent(database, visit, actor, "leave", 0, "Left on time");
    await closeVisit(database, visitId);
  });
  return (await getVisitById(visitId))!;
}

export async function cancelHold(visitId: number, actor: TillActor): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  if (!canFloorDrop(visit)) {
    throw new Error("This bill needs payment or a manager void.");
  }
  await tx(async (database) => {
    await writeTillEvent(database, visit, actor, "leave", 0, "Closed");
    await closeVisit(database, visitId);
  });
  return (await getVisitById(visitId))!;
}

export async function voidVisit(visitId: number, actor: TillActor): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  const settings = await getSettings();
  const quote = playIsOvertime(visit) ? quoteOvertime(visit.paidUntil, settings.rates) : null;
  const wiped = unpaidFood(visit) + unpaidPlay(visit) + (quote?.amountNu ?? 0);
  await tx(async (database) => {
    await writeTillEvent(database, visit, actor, "void", wiped, "Void");
    await database.exec("DELETE FROM tab_lines WHERE visit_id = ? AND paid = 0", [visitId]);
    await database.exec("DELETE FROM play_blocks WHERE visit_id = ? AND paid = 0", [visitId]);
    await closeVisit(database, visitId);
  });
  return (await getVisitById(visitId))!;
}

export async function waiveOvertime(visitId: number, actor: TillActor): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  if (!playIsOvertime(visit)) throw new Error("This play is not overtime.");
  if (unpaidFood(visit) > 0 || unpaidPlay(visit) > 0) {
    throw new Error("Take payment for the bill first. A manager can only make the overtime free.");
  }
  const settings = await getSettings();
  const quote = quoteOvertime(visit.paidUntil, settings.rates);
  await tx(async (database) => {
    await writeTillEvent(database, visit, actor, "waive", quote?.amountNu ?? 0, "Overtime free");
    await closeVisit(database, visitId);
  });
  return (await getVisitById(visitId))!;
}

export async function voidLineTo(lineId: number, nextQty: number, actor: TillActor): Promise<VisitView> {
  const line = await query().one<{
    id: number;
    visit_id: number;
    name: string;
    qty: number;
    unit_nu: number;
    paid: number;
    fired_qty: number;
  }>("SELECT id, visit_id, name, qty, unit_nu, paid, fired_qty FROM tab_lines WHERE id = ?", [lineId]);
  if (!line || line.paid === 1) throw new Error("That item is already paid.");
  const visit = await requireOpen(line.visit_id);
  const next = Math.max(0, Math.round(nextQty));
  if (next > line.qty) throw new Error("The quantity cannot go up from a void.");
  const fired = line.fired_qty ?? 0;
  if (next >= fired) throw new Error("That quantity has not reached the kitchen.");
  const removed = line.qty - next;
  await tx(async (database) => {
    await writeTillEvent(database, visit, actor, "void", removed * line.unit_nu, `Void ${removed} × ${line.name}`);
    if (next <= 0) {
      await database.exec("DELETE FROM tab_lines WHERE id = ? AND paid = 0", [lineId]);
    } else {
      await database.exec("UPDATE tab_lines SET qty = ?, amount_nu = ?, fired_qty = ? WHERE id = ?", [
        next,
        next * line.unit_nu,
        next,
        lineId,
      ]);
    }
  });
  return (await getVisitById(line.visit_id))!;
}

export async function removeLatestUnpaidBlock(visitId: number): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  const latest = [...visit.blocks].reverse().find((block) => !block.paid);
  if (!latest) throw new Error("There is no unpaid play block to remove.");
  if (visit.blocks[visit.blocks.length - 1]?.id !== latest.id) {
    throw new Error("Only the latest unpaid play block can be removed.");
  }
  await tx(async (database) => {
    await database.exec("DELETE FROM play_blocks WHERE id = ? AND paid = 0", [latest.id]);
    await database.exec("UPDATE visits SET paid_until = ? WHERE id = ?", [latest.priorUntil, visitId]);
  });
  return (await getVisitById(visitId))!;
}

export async function addWalkInItem(
  itemId: number,
  outlet: Outlet,
  stamp?: { code?: string; clientKey?: string; lineKey?: string },
): Promise<VisitView> {
  await ensureTillSync();
  const item = (await listMenu(outlet)).find((row) => row.id === itemId);
  if (!item) throw new Error("That item is not on this counter.");
  const created = nowIso();
  const visitId = await tx(async (database) => {
    const wanted = (stamp?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    let code = wanted.length >= 4 ? wanted : shortCode();
    while (await database.one("SELECT 1 FROM visits WHERE short_code = ?", [code])) code = shortCode();
    const guardianId = await database.insert("INSERT INTO guardians (phone, name, created_at) VALUES (?, ?, ?)", [
      `F${code}`,
      "Walk-in",
      created,
    ]);
    const createdVisit = await database.insert(
      `INSERT INTO visits (short_code, guardian_id, status, child_count, created_at, paid_until)
       VALUES (?, ?, 'open', 0, ?, ?)`,
      [code, guardianId, created, created],
    );
    await database.exec(
      `INSERT INTO tab_lines
       (visit_id, item_id, name, qty, unit_nu, amount_nu, outlet, paid, created_at, client_key)
       VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?, ?)`,
      [createdVisit, item.id, item.name, item.priceNu, item.priceNu, outlet, created, stamp?.lineKey ?? null],
    );
    return createdVisit;
  });
  if (stamp?.clientKey) {
    await query().exec("UPDATE visits SET client_key = ? WHERE id = ? AND client_key IS NULL", [stamp.clientKey, visitId]);
  }
  return (await getVisitById(visitId))!;
}

export async function addTabItem(visitId: number, itemId: number, outlet: Outlet, lineKey?: string): Promise<VisitView> {
  await ensureTillSync();
  const visit = await requireOpen(visitId);
  const item = (await listMenu(outlet)).find((row) => row.id === itemId);
  if (!item) throw new Error("That item is not on this counter.");
  const existing = visit.lines.find(
    (line) => !line.paid && line.outlet === outlet && line.name === item.name && line.unitNu === item.priceNu,
  );
  if (existing) {
    const qty = existing.qty + 1;
    await query().exec("UPDATE tab_lines SET qty = ?, amount_nu = ? WHERE id = ?", [
      qty,
      qty * existing.unitNu,
      existing.id,
    ]);
  } else {
    await query().exec(
      `INSERT INTO tab_lines
       (visit_id, item_id, name, qty, unit_nu, amount_nu, outlet, paid, created_at, client_key)
       VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?, ?)`,
      [visitId, item.id, item.name, item.priceNu, item.priceNu, outlet, nowIso(), lineKey ?? null],
    );
  }
  return (await getVisitById(visitId))!;
}

export async function saveKot(visitId: number, tableNo: string, lineIds: number[]) {
  const table = tableNo.trim().slice(0, 16);
  if (!table) throw new Error("Type the table number.");
  await requireOpen(visitId);
  await query().exec("UPDATE visits SET table_no = ? WHERE id = ?", [table, visitId]);
  for (const id of lineIds) {
    await query().exec("UPDATE tab_lines SET fired_qty = qty WHERE visit_id = ? AND id = ?", [visitId, id]);
  }
  return (await getVisitById(visitId))!;
}

export async function changeLineQty(lineId: number, delta: number): Promise<VisitView> {
  const line = await query().one<{ id: number; visit_id: number; qty: number; unit_nu: number; paid: number; fired_qty: number }>(
    "SELECT id, visit_id, qty, unit_nu, paid, fired_qty FROM tab_lines WHERE id = ?",
    [lineId],
  );
  if (!line || line.paid === 1) throw new Error("That line is already paid.");
  await requireOpen(line.visit_id);
  const qty = line.qty + delta;
  if (qty < (line.fired_qty ?? 0)) throw new Error("The kitchen already has this dish. A manager can void it.");
  if (qty <= 0) {
    await query().exec("DELETE FROM tab_lines WHERE id = ? AND fired_qty = 0", [lineId]);
  } else {
    await query().exec("UPDATE tab_lines SET qty = ?, amount_nu = ? WHERE id = ?", [qty, qty * line.unit_nu, lineId]);
  }
  return (await getVisitById(line.visit_id))!;
}

async function claimJournal(database: Query, visitId: number, method: PayMethod, amountNu: number, journal: string) {
  if (method !== "bank_qr" || amountNu <= 0) return "";
  const ready = await ensureJournalColumn();
  if (!ready) throw new Error("Bank payments need a journal number, and the till cannot store one yet.");
  const ref = journal.trim();
  if (!ref) throw new Error("Type the journal number from the bank SMS.");
  const range = thimphuDayRange();
  const used = await database.one<{ id: number }>(
    `SELECT id FROM payments
     WHERE lower(journal_ref) = lower(?) AND visit_id <> ? AND created_at >= ? AND created_at < ?
     LIMIT 1`,
    [ref, visitId, range.start, range.end],
  );
  if (used) throw new Error("That journal number was already used today.");
  return ref;
}

async function recordPayment(
  database: Query,
  visitId: number,
  kind: string,
  method: PayMethod,
  amountNu: number,
  station: string,
  journal = "",
  payBank = "",
) {
  if (amountNu <= 0) return;
  const ref = await claimJournal(database, visitId, method, amountNu, journal);
  if (ref) {
    const bankName = knownBank(payBank) || bankFromJournal(ref);
    if (!bankName) throw new Error("Pick the bank for this journal number.");
    await database.exec(
      `INSERT INTO payments (visit_id, kind, method, amount_nu, station, created_at, journal_ref, pay_bank)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [visitId, kind, method, amountNu, station, nowIso(), ref, bankName],
    );
    return;
  }
  await database.exec(
    `INSERT INTO payments (visit_id, kind, method, amount_nu, station, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [visitId, kind, method, amountNu, station, nowIso()],
  );
}

export async function payOutlet(
  visitId: number,
  outlet: Outlet,
  pay: PayMethod | { cashNu: number; bankNu: number },
  journal = "",
  payBank = "",
): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  const due = visit.lines
    .filter((line) => line.outlet === outlet && !line.paid)
    .reduce((sum, line) => sum + line.amountNu, 0);
  if (due <= 0) throw new Error("Nothing to take on this counter.");
  const parts = splitParts(due, pay);
  const ref = journal.trim();
  await tx(async (database) => {
    await database.exec("UPDATE tab_lines SET paid = 1 WHERE visit_id = ? AND outlet = ? AND paid = 0", [
      visitId,
      outlet,
    ]);
    await recordPayment(database, visitId, "food", "cash", parts.cashNu, outlet);
    await recordPayment(database, visitId, "food", "bank_qr", parts.bankNu, outlet, ref, payBank);
  });
  return (await getVisitById(visitId))!;
}

export async function payPlayDue(
  visitId: number,
  pay: PayMethod | { cashNu: number; bankNu: number },
  station: string,
  journal = "",
  payBank = "",
): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  const due = visit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0);
  if (due <= 0) throw new Error("Playtime is already paid.");
  const parts = splitParts(due, pay);
  const ref = journal.trim();
  await tx(async (database) => {
    await database.exec("UPDATE play_blocks SET paid = 1 WHERE visit_id = ? AND paid = 0", [visitId]);
    await recordPayment(database, visitId, "extension", "cash", parts.cashNu, station);
    await recordPayment(database, visitId, "extension", "bank_qr", parts.bankNu, station, ref, payBank);
  });
  return (await getVisitById(visitId))!;
}

export async function settleVisit(
  visitId: number,
  pay: PayMethod | { cashNu: number; bankNu: number },
  journal = "",
  payBank = "",
): Promise<VisitView> {
  const visit = await requireOpen(visitId);
  const foodDue = visit.lines.filter((line) => !line.paid).reduce((sum, line) => sum + line.amountNu, 0);
  const playDue = visit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0);
  const settings = await getSettings();
  const quote = quoteOvertime(visit.paidUntil, settings.rates);
  if (quote && quote.extraMinutes > 0 && quote.blocks.length === 0) {
    throw new Error(`They stayed ${quote.extraMinutes} min past play time. Set a play rate before closing.`);
  }
  const due = foodDue + playDue + (quote?.amountNu ?? 0);
  const parts = splitParts(due, pay);
  const pot = { cash: parts.cashNu, bank: parts.bankNu };
  const ref = journal.trim();
  const closed = nowIso();
  await tx(async (database) => {
    if (foodDue > 0) {
      await database.exec("UPDATE tab_lines SET paid = 1 WHERE visit_id = ? AND paid = 0", [visitId]);
      await payKind(database, visitId, "food", foodDue, pot, ref, payBank);
    }
    if (playDue > 0) {
      await database.exec("UPDATE play_blocks SET paid = 1 WHERE visit_id = ? AND paid = 0", [visitId]);
      await payKind(database, visitId, "extension", playDue, pot, ref, payBank);
    }
    if (quote && quote.amountNu > 0) {
      await recordOvertime(database, visit, quote);
      await payKind(database, visitId, "extension", quote.amountNu, pot, ref, payBank);
    }
    await database.exec("UPDATE visits SET status = 'settled', closed_at = ? WHERE id = ?", [closed, visitId]);
  });
  return (await getVisitById(visitId))!;
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

async function payKind(
  database: Query,
  visitId: number,
  kind: string,
  need: number,
  pot: { cash: number; bank: number },
  journal = "",
  payBank = "",
) {
  const cash = Math.min(pot.cash, need);
  pot.cash -= cash;
  const bank = need - cash;
  pot.bank -= bank;
  await recordPayment(database, visitId, kind, "cash", cash, "cashier");
  await recordPayment(database, visitId, kind, "bank_qr", bank, "cashier", journal, payBank);
}

async function recordOvertime(database: Query, visit: VisitView, quote: OvertimeQuote) {
  let prior = visit.paidUntil;
  const created = nowIso();
  for (const block of quote.blocks) {
    const extendsTo = addMinutes(prior, block.minutes);
    await database.exec(
      `INSERT INTO play_blocks
       (visit_id, minutes, amount_nu, paid, prior_until, extends_to, created_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [visit.id, block.minutes, block.amountNu, prior, extendsTo, created],
    );
    prior = extendsTo;
  }
  await database.exec("UPDATE visits SET paid_until = ? WHERE id = ?", [prior, visit.id]);
}

export async function listRecentTransactions(limit = 40): Promise<RecentTxn[]> {
  await ensureTillEvents();
  const range = thimphuDayRange();
  const rows = await query().many<{
    id: number;
    kind: string;
    method: PayMethod;
    amount_nu: number;
    station: string;
    created_at: string;
    short_code: string;
    status: "open" | "settled";
    phone: string;
  }>(
    `SELECT p.id, p.kind, p.method, p.amount_nu, p.station, p.created_at,
            v.short_code, v.status, g.phone
     FROM payments p
     JOIN visits v ON v.id = p.visit_id
     JOIN guardians g ON g.id = v.guardian_id
     WHERE p.created_at >= ? AND p.created_at < ?
     ORDER BY p.id DESC
     LIMIT ?`,
    [range.start, range.end, limit],
  );
  const events = await query().many<{
    id: number;
    code: string;
    phone: string;
    staff_name: string;
    kind: string;
    amount_nu: number;
    created_at: string;
  }>(
    `SELECT id, code, phone, staff_name, kind, amount_nu, created_at
     FROM till_events
     WHERE created_at >= ? AND created_at < ?
     ORDER BY id DESC
     LIMIT ?`,
    [range.start, range.end, limit],
  );
  const payments: RecentTxn[] = rows.map((row) => ({
    id: row.id,
    code: row.short_code,
    phone: row.phone,
    status: row.status,
    kind: row.kind,
    method: row.method,
    amountNu: row.amount_nu,
    station: row.station,
    staffName: "",
    createdAt: row.created_at,
  }));
  const notes: RecentTxn[] = events.map((row) => ({
    id: row.id,
    code: row.code,
    phone: row.phone,
    status: "settled",
    kind: row.kind,
    method: "",
    amountNu: row.amount_nu,
    station: "cashier",
    staffName: row.staff_name,
    createdAt: row.created_at,
  }));
  return [...payments, ...notes]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function dayTotals(): Promise<{ totalNu: number; playNu: number; foodNu: number }> {
  const range = thimphuDayRange();
  const row = await query().one<{ total: number; play: number; food: number }>(
    `SELECT
       COALESCE(SUM(amount_nu), 0) AS total,
       COALESCE(SUM(amount_nu) FILTER (WHERE kind IN ('playtime', 'extension')), 0) AS play,
       COALESCE(SUM(amount_nu) FILTER (WHERE kind = 'food'), 0) AS food
     FROM payments
     WHERE created_at >= ? AND created_at < ?`,
    [range.start, range.end],
  );
  return {
    totalNu: Number(row?.total ?? 0),
    playNu: Number(row?.play ?? 0),
    foodNu: Number(row?.food ?? 0),
  };
}

export async function daySummary(): Promise<DaySummary> {
  const range = thimphuDayRange();
  const payments = await query().many<{
    id: number;
    kind: string;
    method: PayMethod;
    amount_nu: number;
    station: string;
    created_at: string;
  }>(
    `SELECT id, kind, method, amount_nu, station, created_at
     FROM payments
     WHERE created_at >= ? AND created_at < ?
     ORDER BY id DESC`,
    [range.start, range.end],
  );
  const mapped: PaymentRow[] = payments.map((payment) => ({
    id: payment.id,
    kind: payment.kind,
    method: payment.method,
    amountNu: payment.amount_nu,
    station: payment.station,
    createdAt: payment.created_at,
  }));
  const openCount = Number(
    (await query().one<{ n: number }>("SELECT COUNT(*) AS n FROM visits WHERE status = 'open'"))?.n ?? 0,
  );
  const settledCount = Number(
    (
      await query().one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM visits WHERE status = 'settled' AND closed_at >= ? AND closed_at < ?",
        [range.start, range.end],
      )
    )?.n ?? 0,
  );
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

export async function floorPulse(): Promise<FloorPulse> {
  const summary = await daySummary();
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
  const older = await query().many<{ amount_nu: number; created_at: string }>(
    `SELECT amount_nu, created_at FROM payments WHERE created_at >= ? AND created_at < ?`,
    [weekStart, today.end],
  );
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
    open: (await listOpenVisits()).map((visit) => ({
      code: visit.code,
      phone: visit.phone,
      dueNu: visit.dueNu,
      minutes: minutesLeft(visit.paidUntil),
      children: visit.childCount,
    })),
  };
}

export async function listStaff(): Promise<StaffRow[]> {
  const rows = await query().many<{ id: number; name: string; role: StaffRow["role"]; active: number }>(
    "SELECT id, name, role, active FROM staff ORDER BY id",
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    active: row.active === 1,
  }));
}

export async function addStaff(name: string, role: StaffRow["role"], secret: string) {
  const clean = name.trim();
  if (!clean) throw new Error("Name is required.");
  if (secret.trim().length < 4) throw new Error("Use at least 4 characters for the password or PIN.");
  await query().exec("INSERT INTO staff (name, role, secret_hash, active) VALUES (?, ?, ?, 1)", [
    clean,
    role,
    makeSecret(secret.trim()),
  ]);
  await putSetting("show_credential_hint", "0");
}

export async function setStaffSecret(id: number, secret: string) {
  if (secret.trim().length < 4) throw new Error("Use at least 4 characters for the password or PIN.");
  await query().exec("UPDATE staff SET secret_hash = ? WHERE id = ?", [makeSecret(secret.trim()), id]);
  await putSetting("show_credential_hint", "0");
}

export async function setStaffActive(id: number, active: boolean) {
  const row = await query().one<{ role: string }>("SELECT role FROM staff WHERE id = ?", [id]);
  if (!row) throw new Error("Staff not found.");
  if (!active && row.role === "admin") {
    const admins = await query().one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM staff WHERE role = 'admin' AND active = 1 AND id != ?",
      [id],
    );
    if (Number(admins?.n ?? 0) === 0) throw new Error("Keep at least one active admin.");
  }
  await query().exec("UPDATE staff SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
}
