import type { MenuItem, Rate, VisitView } from "@/lib/types";

export type StaffIdentity = {
  staffId?: number;
  staffName: string;
  role: string;
  deviceLabel: string;
  deviceId: string;
};

export type AuditEvent = {
  id: string;
  type: "admission" | "order" | "settle" | "print" | "overtime";
  title: string;
  details: string;
  amountNu?: number;
  staffName: string;
  deviceLabel: string;
  timestamp: string;
};

export type V2PrintJob = {
  id: string;
  kind: "wristband" | "kot" | "receipt" | "test";
  title: string;
  body: string;
  target?: "counter" | "kitchen" | "all";
  staffName: string;
  deviceLabel: string;
  timestamp: string;
};

export type V2BootstrapData = {
  venueName: string;
  tagline: string;
  phone: string;
  address: string;
  rates: Rate[];
  extraPerMinNu: number;
  bankPayload: string;
  bankAccount: string;
  payee: string;
  city?: string;
  menu: MenuItem[];
  visits: VisitView[];
  staff: { id: number; name: string; role: string }[];
  todayNu: number;
  playNu: number;
  foodNu: number;
};
