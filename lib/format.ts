export function formatNu(amount: number): string {
  return `Nu ${amount.toLocaleString("en-IN")}`;
}

export function tableLabel(tableNo: string): string {
  const table = tableNo.trim().replace(/^table\s+/i, "");
  if (!table || table.toLowerCase() === "standing") return "Standing";
  return `Table ${table}`;
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Thimphu",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatOrderStamp(iso: string): { date: string; clock: string } {
  const when = new Date(iso);
  return {
    date: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Thimphu",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(when),
    clock: new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Thimphu",
      hour: "numeric",
      minute: "2-digit",
    }).format(when),
  };
}

export function minutesLeft(paidUntil: string, now = Date.now()): number {
  return Math.ceil((new Date(paidUntil).getTime() - now) / 60000);
}

export function thimphuDayRange(date = new Date()): {
  start: string;
  end: string;
  key: string;
} {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const start = new Date(`${key}T00:00:00+06:00`);
  return {
    key,
    start: start.toISOString(),
    end: new Date(start.getTime() + 86_400_000).toISOString(),
  };
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return "";
  return digits.slice(-8);
}

export function formatPhone(phone: string): string {
  if (phone.length !== 8) return phone;
  return `${phone.slice(0, 4)} ${phone.slice(4)}`;
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}
