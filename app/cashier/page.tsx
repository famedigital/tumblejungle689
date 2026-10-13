import { CashierTouch } from "@/components/cashier-touch";
import { requireArea } from "@/lib/auth";
import { getSettings, dayTotals, listMenu, listOpenVisits, listRecentTransactions, searchVisit } from "@/lib/domain";
import { normalizePhone } from "@/lib/format";
import { staticFromSettings } from "@/lib/emv";
import { requestOrigin, visitPath } from "@/lib/origin";
import { qrDataUrl } from "@/lib/qr";
import type { VisitView } from "@/lib/types";

export default async function CashierPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; ok?: string; print?: string; hold?: string; new?: string }>;
}) {
  const session = await requireArea("cashier");
  const query = await searchParams;
  const [settings, day, menu, open, recent, origin] = await Promise.all([
    getSettings(),
    dayTotals(),
    listMenu(),
    listOpenVisits(),
    listRecentTransactions(),
    requestOrigin(),
  ]);
  const visit = query.q ? (openVisitMatch(open, query.q) ?? (await searchVisit(query.q))) : null;
  const staticPayload = staticFromSettings({
    payload: settings.bankPayload,
    account: settings.bankAccount,
    payee: settings.payee,
    city: settings.city,
  });
  const ticketUrl = visit ? `${origin}${visitPath(visit.code)}` : "";
  const qr = visit ? await qrDataUrl(ticketUrl) : "";

  return (
    <CashierTouch
      staffName={session.name}
      rates={settings.rates}
      menu={menu}
      staticPayload={staticPayload}
      visit={visit}
      open={open}
      recent={recent}
      todayNu={day.totalNu}
      playNu={day.playNu}
      foodNu={day.foodNu}
      error={query.error}
      ok={query.ok}
      query={query.q}
      qr={qr}
      ticketUrl={ticketUrl}
      venueName={settings.venueName}
      bankAccount={settings.bankAccount}
      journalScan={settings.journalScan}
      venueAddress={settings.address}
      receiptNote={settings.receiptNote}
      receiptThanks={settings.receiptThanks}
      receiptRules={settings.receiptRules}
      printTicket={query.print === "ticket"}
      printReceipt={query.print === "receipt"}
      printPack={query.print === "pack"}
      holdOpen={query.hold === "1"}
      startNew={query.new === "1"}
    />
  );
}

function openVisitMatch(open: VisitView[], term: string): VisitView | null {
  const trimmed = term.trim();
  const fromUrl = trimmed.match(/\/t\/([A-Za-z0-9]+)/);
  const code = (fromUrl?.[1] ?? trimmed).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const byCode = open.find((item) => item.code === code);
  if (byCode) return byCode;
  const phone = normalizePhone(trimmed);
  return phone ? (open.find((item) => item.phone === phone) ?? null) : null;
}
