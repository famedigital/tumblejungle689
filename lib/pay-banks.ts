/** Apps a customer can pay from. 126- is mBoB. */
export const PAY_BANKS = [
  { id: "mbob", label: "MBOB", prefixes: ["126"] },
  { id: "mpay", label: "MPAY", prefixes: [] },
  { id: "dpay", label: "DPAY", prefixes: [] },
  { id: "tpay", label: "TPAY", prefixes: [] },
  { id: "bpay", label: "BPAY", prefixes: [] },
  { id: "bt", label: "BT WALLET", prefixes: [] },
  { id: "gobob", label: "GO BOB", prefixes: [] },
] as const;

export type PayBankLabel = (typeof PAY_BANKS)[number]["label"];

export function knownBank(raw: string): string {
  const label = raw.trim().toUpperCase();
  return PAY_BANKS.some((bank) => bank.label === label) ? label : "";
}

export function bankFromJournal(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/[\s-]+/g, "");
  if (!compact) return "";
  const hit = PAY_BANKS.find((bank) => bank.prefixes.some((prefix) => compact.startsWith(prefix)));
  return hit?.label ?? "";
}
