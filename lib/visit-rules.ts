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

export function canLeaveOnTime(visit: VisitView, now = Date.now()): boolean {
  if (!isPlayVisit(visit) || playIsOvertime(visit, now)) return false;
  return unpaidFood(visit) === 0 && unpaidPlay(visit) === 0;
}

export function canFloorDrop(visit: VisitView, now = Date.now()): boolean {
  if (isPlayVisit(visit) || playIsOvertime(visit, now)) return false;
  return unpaidFood(visit) === 0 && unpaidPlay(visit) === 0 && !hasFiredUnpaid(visit);
}
