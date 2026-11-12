import type { VisitView } from "@/lib/types";

export function isPlayVisit(visit: Pick<VisitView, "childCount" | "blocks">): boolean {
  return visit.childCount > 0 || visit.blocks.length > 0;
}

export function playIsOvertime(visit: Pick<VisitView, "childCount" | "blocks" | "paidUntil">, now = Date.now()): boolean {
  if (!isPlayVisit(visit)) return false;
  return new Date(visit.paidUntil).getTime() < now;
}

export function unpaidFood(visit: Pick<VisitView, "lines">): number {
  return visit.lines.filter((line) => !line.paid).reduce((sum, line) => sum + line.amountNu, 0);
}

export function unpaidPlay(visit: Pick<VisitView, "blocks">): number {
  return visit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0);
}

export function hasFiredUnpaid(visit: Pick<VisitView, "lines">): boolean {
  return visit.lines.some((line) => !line.paid && line.firedQty > 0);
}

/** Effective clock for leave rules — Hold freezes overtime at leftAt. */
export function leaveClockMs(visit: Pick<VisitView, "leftAt">, now = Date.now()): number {
  return visit.leftAt ? new Date(visit.leftAt).getTime() : now;
}

export function canLeaveOnTime(visit: VisitView, now = Date.now()): boolean {
  if (!isPlayVisit(visit)) return false;
  if (unpaidFood(visit) !== 0 || unpaidPlay(visit) !== 0) return false;
  // Hold stops the OT clock: if they held before paidUntil, staff can clear the floor.
  return new Date(visit.paidUntil).getTime() >= leaveClockMs(visit, now);
}

export function canFloorDrop(visit: VisitView, now = Date.now()): boolean {
  if (isPlayVisit(visit)) return false;
  if (unpaidFood(visit) !== 0 || unpaidPlay(visit) !== 0 || hasFiredUnpaid(visit)) return false;
  return true;
}

/** Play visit fully paid and not in OT (respecting Hold) — safe to clear off the floor. */
export function canClearPlay(visit: VisitView, now = Date.now()): boolean {
  return canLeaveOnTime(visit, now);
}
