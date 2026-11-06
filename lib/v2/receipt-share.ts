import type { PayMethod } from "@/lib/types";

export type WhatsAppReceiptInput = {
  venueName: string;
  tagline?: string;
  address?: string;
  phone?: string;
  receiptNo?: number | null;
  code: string;
  guardianName?: string;
  customerPhone?: string;
  childCount?: number;
  durationMinutes?: number;
  playNu?: number;
  lines?: { name: string; qty: number; amountNu: number }[];
  overtimeNu?: number;
  overtimeMin?: number;
  totalPaidNu: number;
  method: PayMethod;
  payBank?: string;
  journalRef?: string;
  staffName?: string;
  thanksNote?: string;
};

export function buildProfessionalWhatsAppReceipt(data: WhatsAppReceiptInput): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const divider = "━━━━━━━━━━━━━━━━━━━━";

  const linesFormatted = (data.lines || [])
    .filter((l) => l.qty > 0)
    .map((l) => `  • ${l.qty}x ${l.name} — Nu. ${l.amountNu}`)
    .join("\n");

  const bankInfo =
    data.method === "bank_qr"
      ? `💳 *Method:* ${data.payBank || "mBOB / Bank QR"}\n🔖 *Journal Ref:* ${data.journalRef || "Verified"}`
      : `💵 *Method:* Cash Payment`;

  const playSection =
    (data.playNu || 0) > 0 || (data.durationMinutes || 0) > 0
      ? `⏱️ *Play Admission:* ${data.childCount || 1} child(ren) • ${data.durationMinutes || 60}m — Nu. ${data.playNu || 0}\n`
      : "";

  const overtimeSection =
    (data.overtimeNu || 0) > 0
      ? `⚠️ *Overtime:* +${data.overtimeMin || 0} min — Nu. ${data.overtimeNu}\n`
      : "";

  const foodSection = linesFormatted
    ? `🍽️ *Food & Drinks Tab:*\n${linesFormatted}\n`
    : "";

  const message = [
    `🎪 *${(data.venueName || "TUMBLE JUNGLE").toUpperCase()}* 🎪`,
    data.tagline ? `_${data.tagline}_` : "_Indoor Playground & Family Cafe_",
    `📍 ${data.address || "Changjiji, Thimphu"} | Tel: ${data.phone || "17123456"}`,
    divider,
    `🧾 *OFFICIAL RECEIPT #${data.receiptNo || "TJ"}*`,
    `📅 Date: ${dateStr}, ${timeStr}`,
    `🎟️ Pass Ref: *${data.code}*`,
    `👤 Customer: *${data.guardianName || "Guest"}* (${data.customerPhone || "N/A"})`,
    divider,
    playSection + foodSection + overtimeSection + divider,
    `💰 *TOTAL PAID:* *Nu. ${data.totalPaidNu}*`,
    bankInfo,
    divider,
    data.staffName ? `👤 Served by: ${data.staffName}` : "",
    `🙏 _${data.thanksNote || "Thank you for visiting Tumble Jungle! Have a wonderful day!"}_`,
    divider,
    `🔗 *Digital Slip:* https://tumblejungle689.vercel.app/receipt/${data.code}`,
  ]
    .filter(Boolean)
    .join("\n");

  return message;
}

export function openWhatsAppReceipt(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "").slice(-8);
  const target = digits.length === 8 ? `975${digits}` : "";
  const url = target
    ? `https://wa.me/${target}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}
