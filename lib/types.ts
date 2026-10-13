export type Role = "admin" | "frontdesk" | "cafe" | "restaurant" | "cashier";
export type Outlet = "cafe" | "restaurant";
export type PayMethod = "cash" | "bank_qr";
export type Area = "desk" | "cafe" | "restaurant" | "cashier" | "admin";

export type Rate = { minutes: number; amountNu: number };

export type Settings = {
  venueName: string;
  tagline: string;
  address: string;
  hours: string;
  phone: string;
  about: string;
  playBlurb: string;
  eatBlurb: string;
  rates: Rate[];
  ratesAreSamples: boolean;
  menuIsSample: boolean;
  bankPayload: string;
  bankAccount: string;
  payee: string;
  city: string;
  showCredentialHint: boolean;
  receiptNote: string;
  receiptThanks: string;
  receiptRules: string;
  journalScan: boolean;
};

export type MenuItem = {
  id: number;
  categoryId: number;
  category: string;
  outlet: Outlet;
  name: string;
  priceNu: number;
  active: boolean;
};

export type PlayBlock = {
  id: number;
  minutes: number;
  amountNu: number;
  paid: boolean;
  priorUntil: string;
  extendsTo: string;
  createdAt: string;
};

export type TabLine = {
  id: number;
  lineKey?: string;
  name: string;
  qty: number;
  unitNu: number;
  amountNu: number;
  outlet: Outlet;
  paid: boolean;
  firedQty: number;
};

export type PaymentRow = {
  id: number;
  kind: string;
  method: PayMethod;
  amountNu: number;
  station: string;
  createdAt: string;
  journalRef?: string;
  payBank?: string;
};

export type TillActor = { id: number; name: string };

export type RecentTxn = {
  id: number;
  code: string;
  phone: string;
  status: "open" | "settled";
  kind: string;
  method: PayMethod | "";
  amountNu: number;
  station: string;
  staffName: string;
  createdAt: string;
};

export type VisitView = {
  id: number;
  clientKey?: string;
  code: string;
  phone: string;
  guardianName: string;
  childCount: number;
  status: "open" | "settled";
  createdAt: string;
  paidUntil: string;
  closedAt: string | null;
  tableNo: string;
  blocks: PlayBlock[];
  lines: TabLine[];
  payments: PaymentRow[];
  dueNu: number;
  overtime: {
    extraMinutes: number;
    billedMinutes: number;
    amountNu: number;
    blocks: { minutes: number; amountNu: number }[];
  } | null;
};

export type StaffRow = {
  id: number;
  name: string;
  role: Role;
  active: boolean;
};

export type DaySummary = {
  key: string;
  playNu: number;
  foodNu: number;
  totalNu: number;
  cashNu: number;
  bankNu: number;
  openCount: number;
  settledCount: number;
  payments: PaymentRow[];
};

export function can(role: Role, area: Area): boolean {
  if (role === "admin") return true;
  if (area === "desk") return role === "frontdesk";
  if (area === "cafe") return role === "cafe";
  if (area === "restaurant") return role === "restaurant";
  if (area === "cashier") return role === "frontdesk" || role === "cafe" || role === "restaurant" || role === "cashier";
  return false;
}

export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  return "/cashier";
}
