import { findStaffBySecret, type Session } from "@/lib/auth";
import { ensureTillSync, query } from "@/lib/db";
import {
  addChildren,
  addPlayBlock,
  addTabItem,
  addWalkInItem,
  cancelHold,
  createVisit,
  dayTotals,
  getSettings,
  getVisitById,
  leaveOnTime,
  listMenu,
  listOpenVisits,
  listRecentTransactions,
  removeLatestUnpaidBlock,
  removeTabLine,
  saveKot,
  searchVisit,
  settleVisit,
  voidLineTo,
  voidVisit,
  waiveOvertime,
  changeLineQty,
} from "@/lib/domain";
import type { TillOp } from "@/lib/till-op";
import type { PayMethod, VisitView } from "@/lib/types";
import type { TillBase } from "@/lib/till-store";

export type TillSnapshot = TillBase & { focus: VisitView | null };

export class TillBusy extends Error {
  constructor() {
    super("Still saving this change.");
    this.name = "TillBusy";
  }
}

export async function loadTillSnapshot(term?: string): Promise<TillSnapshot> {
  await ensureTillSync();
  const [settings, day, menu, visits, recent] = await Promise.all([
    getSettings(),
    dayTotals(),
    listMenu(),
    listOpenVisits(),
    listRecentTransactions(),
  ]);
  const focus = term ? (visits.find((visit) => visit.code === term.trim().toUpperCase()) ?? (await searchVisit(term))) : null;
  return {
    visits,
    menu,
    recent,
    todayNu: day.totalNu,
    playNu: day.playNu,
    foodNu: day.foodNu,
    venueName: settings.venueName,
    address: settings.address,
    rates: settings.rates,
    bankAccount: settings.bankAccount,
    bankPayload: settings.bankPayload,
    payee: settings.payee,
    city: settings.city,
    journalScan: settings.journalScan,
    receiptNote: settings.receiptNote,
    receiptThanks: settings.receiptThanks,
    receiptRules: settings.receiptRules,
    savedAt: new Date().toISOString(),
    focus,
  };
}

export async function applyTillBatch(ops: TillOp[], session: Session): Promise<{
  applied: { id: string; visit: VisitView }[];
  failedId?: string;
  error?: string;
  retry?: boolean;
  todayNu?: number;
  playNu?: number;
  foodNu?: number;
}> {
  const applied: { id: string; visit: VisitView }[] = [];
  for (const op of ops) {
    try {
      const visit = await applyTillOp(op, session);
      applied.push({ id: op.id, visit });
    } catch (error) {
      const retry = error instanceof TillBusy;
      return {
        applied,
        failedId: op.id,
        retry,
        error: error instanceof Error ? error.message : "Could not save.",
      };
    }
  }
  const day = applied.length ? await dayTotals() : null;
  return {
    applied,
    todayNu: day?.totalNu,
    playNu: day?.playNu,
    foodNu: day?.foodNu,
  };
}

async function applyTillOp(op: TillOp, session: Session): Promise<VisitView> {
  await ensureTillSync();
  const cached = await beginOp(op.id);
  if (cached) return cached;
  try {
    const visit = await runOp(op, session);
    await query().exec("UPDATE till_ops SET result = ?, visit_id = ? WHERE client_op_id = ?", [
      JSON.stringify(visit),
      visit.id,
      op.id,
    ]);
    return visit;
  } catch (error) {
    await query().exec("DELETE FROM till_ops WHERE client_op_id = ? AND result = ''", [op.id]);
    throw error;
  }
}

async function beginOp(id: string): Promise<VisitView | null> {
  const row = await query().one<{ result: string; applied_at: string }>(
    "SELECT result, applied_at FROM till_ops WHERE client_op_id = ?",
    [id],
  );
  if (row?.result) return JSON.parse(row.result) as VisitView;
  if (row && Date.now() - new Date(row.applied_at).getTime() < 60_000) throw new TillBusy();
  if (row) await query().exec("DELETE FROM till_ops WHERE client_op_id = ? AND result = ''", [id]);
  try {
    await query().exec("INSERT INTO till_ops (client_op_id, applied_at, result) VALUES (?, ?, '')", [
      id,
      new Date().toISOString(),
    ]);
  } catch {
    throw new TillBusy();
  }
  return null;
}

async function runOp(op: TillOp, session: Session): Promise<VisitView> {
  if (op.kind === "addItem") {
    const existing = await visitByKey(op.visitKey);
    if (!existing) {
      return addWalkInItem(op.itemId, op.outlet, { code: op.code, clientKey: op.visitKey, lineKey: op.lineKey });
    }
    return addTabItem(existing.id, op.itemId, op.outlet, op.lineKey.startsWith("line:") ? undefined : op.lineKey);
  }
  if (op.kind === "checkIn") {
    return createVisit({
      phone: op.phone,
      name: op.name,
      childCount: op.childCount,
      minutes: op.minutes,
      method: op.method,
      cashNu: op.cashNu,
      bankNu: op.bankNu,
      station: "cashier",
      journal: op.journal,
      payBank: op.payBank,
      code: op.code,
      clientKey: op.visitKey,
    });
  }
  const visit = await visitByKey(op.visitKey);
  if (!visit) throw new Error("That bill is not on the till yet.");
  if (op.kind === "qty") return changeLineQty(await lineId(visit.id, op.lineKey), op.delta);
  if (op.kind === "removeLine") return removeTabLine(await lineId(visit.id, op.lineKey));
  if (op.kind === "addChildren") return addChildren(visit.id, op.childCount);
  if (op.kind === "addPlay") return addPlayBlock(visit.id, op.minutes);
  if (op.kind === "removePlay") return removeLatestUnpaidBlock(visit.id);
  if (op.kind === "saveKot") {
    const ids: number[] = [];
    for (const key of op.lineKeys) ids.push(await lineId(visit.id, key));
    return saveKot(visit.id, op.tableNo, ids);
  }
  if (op.kind === "leave") return leaveOnTime(visit.id, { id: session.staffId, name: session.name });
  if (op.kind === "cancel") return cancelHold(visit.id, { id: session.staffId, name: session.name });
  if (op.kind === "waive" || op.kind === "voidVisit" || op.kind === "voidLine") {
    const manager = await findStaffBySecret(op.secret);
    if (!manager || manager.role !== "admin") throw new Error("Manager PIN was not recognised.");
    const actor = { id: manager.id, name: manager.name };
    if (op.kind === "waive") return waiveOvertime(visit.id, actor);
    if (op.kind === "voidVisit") return voidVisit(visit.id, actor);
    return voidLineTo(await lineId(visit.id, op.lineKey), op.nextQty, actor);
  }
  const pay = payOf(op.method, op.cashNu, op.bankNu);
  return settleVisit(visit.id, pay, op.journal, op.payBank);
}

function payOf(method: string, cashNu?: number, bankNu?: number): PayMethod | { cashNu: number; bankNu: number } {
  if (method === "split") return { cashNu: Math.round(cashNu ?? 0), bankNu: Math.round(bankNu ?? 0) };
  if (method === "bank_qr") return "bank_qr";
  return "cash";
}

async function visitByKey(key: string): Promise<VisitView | null> {
  if (key.startsWith("server:")) {
    const id = Number(key.slice("server:".length));
    if (id > 0) return getVisitById(id);
  }
  const row = await query().one<{ id: number }>("SELECT id FROM visits WHERE client_key = ?", [key]);
  return row ? getVisitById(row.id) : null;
}

async function lineId(visitId: number, key: string): Promise<number> {
  if (key.startsWith("line:")) {
    const id = Number(key.slice("line:".length));
    if (id > 0) return id;
  }
  const row = await query().one<{ id: number }>("SELECT id FROM tab_lines WHERE visit_id = ? AND client_key = ?", [
    visitId,
    key,
  ]);
  if (!row) throw new Error("That dish is not on the bill yet.");
  return row.id;
}
