import { notFound } from "next/navigation";
import { SaleTill } from "@/components/sale-till";
import { requireArea } from "@/lib/auth";
import { getSettings, listMenu, listOpenVisits, searchVisit } from "@/lib/domain";
import { staticFromSettings } from "@/lib/emv";
import type { Outlet } from "@/lib/types";

export default async function CounterPage({
  params,
  searchParams,
}: {
  params: Promise<{ outlet: string }>;
  searchParams: Promise<{ q?: string; error?: string; ok?: string }>;
}) {
  const { outlet } = await params;
  if (outlet !== "cafe" && outlet !== "restaurant") notFound();
  const counter = outlet as Outlet;
  const session = await requireArea(counter);
  const query = await searchParams;
  const settings = getSettings();
  const staticPayload = staticFromSettings({
    payload: settings.bankPayload,
    account: settings.bankAccount,
    payee: settings.payee,
    city: settings.city,
  });
  const visit = query.q ? searchVisit(query.q) : null;
  const title = counter === "cafe" ? "Cafe" : "Restaurant";

  return (
    <SaleTill
      staffName={session.name}
      staffRole={session.role}
      title={title}
      back={`/counter/${counter}`}
      outlet={counter}
      menu={listMenu(counter)}
      staticPayload={staticPayload}
      visit={visit}
      open={listOpenVisits()}
      error={query.q && !visit ? "No visit matched that phone or code." : query.error}
      ok={query.ok}
      query={query.q}
    />
  );
}
