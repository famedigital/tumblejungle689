import { CashierTouch } from "@/components/cashier-touch";
import { requireArea } from "@/lib/auth";
import { getSettings, daySummary, listMenu, listOpenVisits, listRecentTransactions, searchVisit } from "@/lib/domain";
import { staticFromSettings } from "@/lib/emv";
import { requestOrigin, visitPath } from "@/lib/origin";
import { qrDataUrl } from "@/lib/qr";

export default async function CashierPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; ok?: string; print?: string; hold?: string }>;
}) {
  const session = await requireArea("cashier");
  const query = await searchParams;
  const settings = getSettings();
  const staticPayload = staticFromSettings({
    payload: settings.bankPayload,
    account: settings.bankAccount,
    payee: settings.payee,
    city: settings.city,
  });
  const day = daySummary();
  const visit = query.q ? searchVisit(query.q) : null;
  const origin = await requestOrigin();
  const ticketUrl = visit ? `${origin}${visitPath(visit.code)}` : "";
  const qr = visit ? await qrDataUrl(ticketUrl) : "";

  return (
    <CashierTouch
      staffName={session.name}
      rates={settings.rates}
      menu={listMenu()}
      staticPayload={staticPayload}
      visit={visit}
      open={listOpenVisits()}
      recent={listRecentTransactions()}
      todayNu={day.totalNu}
      playNu={day.playNu}
      foodNu={day.foodNu}
      error={query.error}
      ok={query.ok}
      query={query.q}
      qr={qr}
      ticketUrl={ticketUrl}
      venueName={settings.venueName}
      venueAddress={settings.address}
      receiptNote={settings.receiptNote}
      receiptThanks={settings.receiptThanks}
      receiptRules={settings.receiptRules}
      printTicket={query.print === "ticket"}
      printReceipt={query.print === "receipt"}
      holdOpen={query.hold === "1"}
    />
  );
}
