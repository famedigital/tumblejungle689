import { notFound } from "next/navigation";
import { Receipt } from "@/components/receipt";
import { ReceiptActions } from "@/components/receipt-actions";
import { requireArea } from "@/lib/auth";
import { chargeRatesOf, formatRate, quoteCharges } from "@/lib/charges";
import { complimentaryOf, getSettings, getVisitByCode } from "@/lib/domain";
import { formatPhone, formatWhen } from "@/lib/format";
import { quoteOvertime } from "@/lib/overtime";
import { bankFromJournal } from "@/lib/pay-banks";

function getReceiptOvertime(paidUntil: string, rates: Parameters<typeof quoteOvertime>[1], extraPerMinNu: number) {
  return quoteOvertime(paidUntil, rates, Date.now(), extraPerMinNu);
}

export default async function ReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  await requireArea("cashier");
  const { code } = await params;
  const visit = await getVisitByCode(code);
  if (!visit) notFound();
  const settings = await getSettings();
  const overtime = visit.status === "open" ? getReceiptOvertime(visit.paidUntil, settings.rates, settings.extraPerMinNu) : null;

  // Prepaid first play (playtime payments) — note only, not charge lines on settle slip.
  let prepaidBudget = visit.payments
    .filter((payment) => payment.kind === "playtime")
    .reduce((sum, payment) => sum + payment.amountNu, 0);
  const prepaidMinutes: number[] = [];
  const chargeBlocks = [];
  for (const block of visit.blocks) {
    if (prepaidBudget >= block.amountNu && block.paid) {
      prepaidBudget -= block.amountNu;
      prepaidMinutes.push(block.minutes);
    } else {
      chargeBlocks.push(block);
    }
  }
  const playPaidNote = prepaidMinutes.length
    ? `Play pass paid at check-in (${prepaidMinutes.map((m) => `${m} min`).join(", ")})`
    : "";

  const lines = [
    ...chargeBlocks.map((block) => ({
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
  const paidService = visit.payments.filter((payment) => payment.kind === "service").reduce((sum, payment) => sum + payment.amountNu, 0);
  const paidGst = visit.payments.filter((payment) => payment.kind === "gst").reduce((sum, payment) => sum + payment.amountNu, 0);
  const openQuote =
    visit.status === "open"
      ? quoteCharges(
          lines.filter((line) => !line.paid).reduce((sum, line) => sum + line.amount, 0),
          chargeRatesOf(settings),
        )
      : null;
  const comp = visit.status === "settled" ? await complimentaryOf(visit.id) : null;
  const complimentary = Boolean(comp);
  const itemSubtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const compQuote = complimentary ? quoteCharges(itemSubtotal, chargeRatesOf(settings)) : null;
  const serviceNu = visit.status === "open" ? (openQuote?.serviceNu ?? 0) : complimentary ? (compQuote?.serviceNu ?? 0) : paidService;
  const gstNu = visit.status === "open" ? (openQuote?.gstNu ?? 0) : complimentary ? (compQuote?.gstNu ?? 0) : paidGst;
  if (serviceNu > 0) lines.push({ name: `S.C. ${formatRate(settings.scPercent)}%`, qty: 1, amount: serviceNu, paid: visit.status !== "open" });
  if (gstNu > 0) lines.push({ name: `GST ${formatRate(settings.gstPercent)}%`, qty: 1, amount: gstNu, paid: visit.status !== "open" });
  const cash = visit.payments.filter((payment) => payment.method === "cash").reduce((sum, payment) => sum + payment.amountNu, 0);
  const bank = visit.payments.filter((payment) => payment.method === "bank_qr").reduce((sum, payment) => sum + payment.amountNu, 0);
  // Settle tender only (exclude prepaid playtime already taken at check-in).
  const settleCash = visit.payments
    .filter((payment) => payment.method === "cash" && payment.kind !== "playtime")
    .reduce((sum, payment) => sum + payment.amountNu, 0);
  const settleBank = visit.payments
    .filter((payment) => payment.method === "bank_qr" && payment.kind !== "playtime")
    .reduce((sum, payment) => sum + payment.amountNu, 0);
  const showCash = visit.status === "settled" ? settleCash : cash;
  const showBank = visit.status === "settled" ? settleBank : bank;
  const banks: { name: string; ref: string; amount: number }[] = [];
  for (const payment of visit.payments) {
    if (payment.method !== "bank_qr" || payment.amountNu <= 0) continue;
    if (visit.status === "settled" && payment.kind === "playtime") continue;
    const ref = payment.journalRef ?? "";
    const name = payment.payBank || bankFromJournal(ref) || "Bank QR";
    const hit = banks.find((row) => row.name === name && row.ref === ref);
    if (hit) hit.amount += payment.amountNu;
    else banks.push({ name, ref, amount: payment.amountNu });
  }
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const waiveNu = complimentary ? Math.max(0, Math.round(comp?.amountNu || subtotal - showCash - showBank)) : 0;
  const total =
    visit.status === "open" && visit.dueNu > 0
      ? visit.dueNu
      : complimentary
        ? Math.max(0, subtotal - waiveNu)
        : showCash + showBank;

  return (
    <main className="receipt-stage">
      <ReceiptActions />
      <Receipt
        venue={settings.venueName}
        address={settings.address}
        shopPhone={settings.phone}
        when={formatWhen(visit.closedAt || visit.createdAt)}
        code={visit.code}
        phone={formatPhone(visit.phone)}
        lines={lines}
        total={total}
        cash={showCash}
        bank={showBank}
        banks={banks}
        note={settings.receiptNote}
        thanks={settings.receiptThanks}
        rules={settings.receiptRules.split(/\r?\n/)}
        number={visit.receiptNo}
        complimentary={complimentary}
        waiveNu={complimentary ? waiveNu : null}
        payMethod={complimentary ? "comp" : showCash > 0 && showBank > 0 ? "split" : showCash > 0 ? "cash" : showBank > 0 ? "bank_qr" : ""}
        tableNo={visit.tableNo}
        playPaidNote={playPaidNote}
      />
    </main>
  );
}
