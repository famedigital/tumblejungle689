import { formatNu } from "@/lib/format";
import type { Rate } from "@/lib/types";

export type OvertimeBlock = {
  minutes: number;
  amountNu: number;
};

export type OvertimeQuote = {
  extraMinutes: number;
  billedMinutes: number;
  amountNu: number;
  blocks: OvertimeBlock[];
};

export function quoteOvertime(paidUntil: string, rates: Rate[], now = Date.now()): OvertimeQuote | null {
  const lateMs = now - new Date(paidUntil).getTime();
  if (lateMs <= 0) return null;
  const extraMinutes = Math.ceil(lateMs / 60_000);
  const sorted = [...rates]
    .filter((rate) => rate.minutes > 0 && rate.amountNu >= 0)
    .sort((a, b) => a.minutes - b.minutes);
  if (sorted.length === 0) {
    return { extraMinutes, billedMinutes: 0, amountNu: 0, blocks: [] };
  }
  const blocks: OvertimeBlock[] = [];
  let left = extraMinutes;
  const longest = sorted[sorted.length - 1]!;
  while (left > longest.minutes) {
    blocks.push({ minutes: longest.minutes, amountNu: longest.amountNu });
    left -= longest.minutes;
  }
  const fit = sorted.find((rate) => rate.minutes >= left) ?? longest;
  blocks.push({ minutes: fit.minutes, amountNu: fit.amountNu });
  return {
    extraMinutes,
    billedMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
    amountNu: blocks.reduce((sum, block) => sum + block.amountNu, 0),
    blocks,
  };
}

export function overtimeSentence(quote: OvertimeQuote): string {
  const stayed = `Stayed ${quote.extraMinutes} min past their play time.`;
  if (quote.blocks.length === 0) return `${stayed} Set a play rate to charge this extra time.`;
  if (quote.billedMinutes === quote.extraMinutes) return `${stayed} Extra time ${formatNu(quote.amountNu)}.`;
  const as = quote.blocks.map((block) => `${block.minutes} min`).join(" + ");
  return `${stayed} Charged as ${as}, ${formatNu(quote.amountNu)}.`;
}
