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

export function playBasis(rates: Rate[]): Rate | null {
  return rates.find((rate) => rate.minutes === 30) ?? [...rates].filter((rate) => rate.minutes > 0).sort((a, b) => a.minutes - b.minutes)[0] ?? null;
}

/** Whole-ngultrum charge for extra minutes. A set per-minute price wins. Otherwise the 30 min price is split by the minute, and the total is rounded. */
export function extraCharge(extraMinutes: number, rates: Rate[], perMinNu = 0): number {
  const minutes = Math.max(0, Math.round(extraMinutes));
  if (minutes === 0) return 0;
  if (perMinNu > 0) return minutes * Math.round(perMinNu);
  const base = playBasis(rates);
  if (!base) return 0;
  return Math.round((minutes * base.amountNu) / base.minutes);
}

export function quoteOvertime(paidUntil: string, rates: Rate[], now = Date.now(), perMinNu = 0): OvertimeQuote | null {
  const lateMs = now - new Date(paidUntil).getTime();
  if (lateMs <= 0) return null;
  const extraMinutes = Math.ceil(lateMs / 60_000);
  const amountNu = extraCharge(extraMinutes, rates, perMinNu);
  const blocks: OvertimeBlock[] = amountNu > 0 ? [{ minutes: extraMinutes, amountNu }] : [];
  return {
    extraMinutes,
    billedMinutes: extraMinutes,
    amountNu,
    blocks,
  };
}

export function overtimeSentence(quote: OvertimeQuote): string {
  const stayed = `Stayed ${quote.extraMinutes} min past their play time.`;
  if (quote.amountNu <= 0) return `${stayed} Set a play price before this extra time can be charged.`;
  return `${stayed} Extra time ${formatNu(quote.amountNu)}, by the minute.`;
}
