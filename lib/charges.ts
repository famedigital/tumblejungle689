export type ChargeRates = {
  scOn: boolean;
  scPercent: number;
  gstOn: boolean;
  gstPercent: number;
};

export type ChargeQuote = {
  subtotalNu: number;
  serviceNu: number;
  gstNu: number;
  dueNu: number;
};

export const chargeDefaults: ChargeRates = {
  scOn: false,
  scPercent: 10,
  gstOn: false,
  gstPercent: 5,
};

export function readPercent(value: unknown, fallback: number): number {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 30) return fallback;
  return Math.round(n * 100) / 100;
}

export function parsePercent(value: unknown): number {
  const n = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(n) || n < 0 || n > 30) throw new Error("Enter a rate from 0 to 30.");
  return n;
}

export function chargeRatesOf(source?: Partial<ChargeRates> | null): ChargeRates {
  return {
    scOn: source?.scOn === true,
    scPercent: readPercent(source?.scPercent, chargeDefaults.scPercent),
    gstOn: source?.gstOn === true,
    gstPercent: readPercent(source?.gstPercent, chargeDefaults.gstPercent),
  };
}

export function formatRate(percent: number): string {
  const rounded = Math.round(percent * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function quoteCharges(subtotalNu: number, rates: ChargeRates): ChargeQuote {
  const subtotal = Math.max(0, Math.round(subtotalNu));
  const serviceNu = rates.scOn ? Math.round((subtotal * rates.scPercent) / 100) : 0;
  const gstNu = rates.gstOn ? Math.round(((subtotal + serviceNu) * rates.gstPercent) / 100) : 0;
  return { subtotalNu: subtotal, serviceNu, gstNu, dueNu: subtotal + serviceNu + gstNu };
}
