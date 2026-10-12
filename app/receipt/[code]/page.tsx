import { notFound } from "next/navigation";
import { Receipt } from "@/components/receipt";
import { ReceiptActions } from "@/components/receipt-actions";
import { requireArea } from "@/lib/auth";
import { getSettings, getVisitByCode } from "@/lib/domain";
import { formatPhone, formatWhen } from "@/lib/format";
import { quoteOvertime } from "@/lib/overtime";

export default async function ReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  await requireArea("cashier");
  const { code } = await params;
  const visit = getVisitByCode(code);
  if (!visit) notFound();
  const settings = getSettings();
  const overtime = visit.status === "open" ? quoteOvertime(visit.paidUntil, settings.rates) : null;
  const lines = [
    ...visit.blocks.map((block) => ({
      name: `Play ${block.minutes} min`,
      qty: 1,
      amount: block.amountNu,
      paid: block.paid,
    })),
    ...(overtime && overtime.amountNu > 0
      ? [{ name: `Extra ${overtime.extraMinutes} min`, qty: 1, amount: overtime.amountNu, paid: false }]
      : []),
    ...visit.lines.map((line) => ({
      name: line.name,
      qty: line.qty,
      amount: line.amountNu,
      paid: line.paid,
    })),
  ];
  const cash = visit.payments.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + payment.amountNu, 0);
  const bank = visit.payments.filter((payment) => payment.method === "bank_qr").reduce((sum, payment) => sum + payment.amountNu, 0);
  const total = visit.status === "open" && visit.dueNu > 0 ? visit.dueNu : cash + bank;

  return (
    <main className="receipt-stage">
      <ReceiptActions />
      <Receipt
        venue={settings.venueName}
        address={settings.address}
        when={formatWhen(visit.closedAt || visit.createdAt)}
        code={visit.code}
        phone={formatPhone(visit.phone)}
        lines={lines}
        total={total}
        cash={cash}
        bank={bank}
        note={settings.receiptNote}
        thanks={settings.receiptThanks}
        rules={settings.receiptRules.split(/\r?\n/)}
      />
    </main>
  );
}
