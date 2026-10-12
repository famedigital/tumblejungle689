import { DeskTill } from "@/components/desk-till";
import { requireArea } from "@/lib/auth";
import { getSettings, getVisitByCode, listOpenVisits, searchVisit } from "@/lib/domain";
import { staticFromSettings } from "@/lib/emv";
import { requestOrigin, visitPath } from "@/lib/origin";
import { qrDataUrl } from "@/lib/qr";

export default async function DeskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; issued?: string; q?: string }>;
}) {
  const session = await requireArea("desk");
  const params = await searchParams;
  const settings = getSettings();
  const staticPayload = staticFromSettings({
    payload: settings.bankPayload,
    account: settings.bankAccount,
    payee: settings.payee,
    city: settings.city,
  });
  const issued = params.issued ? getVisitByCode(params.issued) : null;
  const found = params.q ? searchVisit(params.q) : null;
  const origin = await requestOrigin();
  const pass = issued ?? found;
  const qr = pass ? await qrDataUrl(`${origin}${visitPath(pass.code)}`) : "";

  return (
    <DeskTill
      staffName={session.name}
      staffRole={session.role}
      rates={settings.rates}
      staticPayload={staticPayload}
      visit={found}
      open={listOpenVisits()}
      error={params.error}
      ok={params.ok}
      issued={issued}
      qr={qr}
      ticketUrl={pass ? `${origin}${visitPath(pass.code)}` : ""}
      venueName={settings.venueName}
      query={params.q}
    />
  );
}
