import { formatNu } from "@/lib/format";

export type DayReportPack = {
  venue: string;
  dateKey: string;
  generatedAt: string;
  takings: {
    totalNu: number;
    cashNu: number;
    bankNu: number;
    playNu: number;
    foodNu: number;
    kotNu: number;
    botNu: number;
  };
  counts: {
    openVisits: number;
    settledTickets: number;
    paymentCount: number;
  };
  voidsNu: number;
  compsNu: number;
  hours: { hour: string; play: number; food: number }[];
  stations: { station: string; amount: number }[];
  openVisits: { code: string; phone: string; dueNu: number }[];
  payments: { time: string; method: string; kind: string; amountNu: number }[];
};

const WA_SOFT_LIMIT = 1400;

function methodLabel(method: string) {
  if (method === "cash") return "Cash";
  if (method === "bank_qr") return "Bank";
  return method || "—";
}

function kindLabel(kind: string) {
  if (kind === "playtime") return "Play";
  if (kind === "extension") return "Extend";
  if (kind === "food") return "F&B";
  return kind || "—";
}

/** Dense plain-text day report for WhatsApp (prefer under ~1500 chars). */
export function formatDayReportWhatsApp(pack: DayReportPack): string {
  const lines: string[] = [
    `${pack.venue} — Day report`,
    `Date ${pack.dateKey}`,
    `Generated ${pack.generatedAt}`,
    "",
    "TAKINGS",
    `Total ${formatNu(pack.takings.totalNu)}`,
    `Cash ${formatNu(pack.takings.cashNu)} · Bank ${formatNu(pack.takings.bankNu)}`,
    `Play ${formatNu(pack.takings.playNu)} · F&B ${formatNu(pack.takings.foodNu)}`,
    `KOT ${formatNu(pack.takings.kotNu)} · Cafe ${formatNu(pack.takings.botNu)}`,
    "",
    "COUNTS",
    `Settled ${pack.counts.settledTickets} · Open ${pack.counts.openVisits} · Pays ${pack.counts.paymentCount}`,
  ];

  if (pack.voidsNu > 0 || pack.compsNu > 0) {
    lines.push(`Voids ${formatNu(pack.voidsNu)} · Comps ${formatNu(pack.compsNu)}`);
  }

  const activeStations = pack.stations.filter((row) => row.amount > 0);
  if (activeStations.length) {
    lines.push("", "STATIONS");
    for (const row of activeStations) {
      lines.push(`${row.station} ${formatNu(row.amount)}`);
    }
  }

  const busyHours = pack.hours.filter((row) => row.play > 0 || row.food > 0);
  if (busyHours.length) {
    lines.push("", "HOURLY");
    for (const row of busyHours) {
      lines.push(`${row.hour} P ${formatNu(row.play)} F ${formatNu(row.food)}`);
    }
  }

  if (pack.openVisits.length) {
    lines.push("", "OPEN DUE");
    for (const visit of pack.openVisits.slice(0, 8)) {
      lines.push(`${visit.code} ${visit.phone || "—"} ${formatNu(visit.dueNu)}`);
    }
  }

  let text = lines.join("\n");
  if (text.length > WA_SOFT_LIMIT) {
    return [
      `${pack.venue} — Day report ${pack.dateKey}`,
      `Total ${formatNu(pack.takings.totalNu)} · Cash ${formatNu(pack.takings.cashNu)} · Bank ${formatNu(pack.takings.bankNu)}`,
      `Play ${formatNu(pack.takings.playNu)} · F&B ${formatNu(pack.takings.foodNu)}`,
      `Settled ${pack.counts.settledTickets} · Open ${pack.counts.openVisits}`,
      pack.voidsNu > 0 || pack.compsNu > 0
        ? `Voids ${formatNu(pack.voidsNu)} · Comps ${formatNu(pack.compsNu)}`
        : null,
      "Full report printed on till.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (pack.payments.length && text.length < WA_SOFT_LIMIT - 80) {
    const digest: string[] = ["", "PAYMENTS"];
    for (const pay of pack.payments.slice(0, 20)) {
      const line = `${pay.time} ${methodLabel(pay.method)} ${kindLabel(pay.kind)} ${formatNu(pay.amountNu)}`;
      if (text.length + digest.join("\n").length + line.length + 1 > WA_SOFT_LIMIT) break;
      digest.push(line);
    }
    if (digest.length > 2) text = `${text}${digest.join("\n")}`;
  }

  return text;
}

export function waMeOwnerUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return `https://wa.me/?text=${encodeURIComponent(text)}`;
  const e164 = digits.length === 8 ? `975${digits}` : digits.startsWith("975") ? digits : digits;
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}
