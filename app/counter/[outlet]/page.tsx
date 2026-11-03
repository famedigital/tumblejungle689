import { notFound, redirect } from "next/navigation";
import { CounterPageClient } from "@/components/counter/counter-page-client";
import { getSession } from "@/lib/auth";
import { getSettings, listMenu } from "@/lib/domain";
import { can, type Outlet } from "@/lib/types";

export default async function CounterPage({ params }: { params: Promise<{ outlet: string }> }) {
  const { outlet: raw } = await params;
  if (raw !== "cafe" && raw !== "restaurant") notFound();
  const outlet = raw as Outlet;
  const session = await getSession();
  if (!session || (!can(session.role, outlet) && !can(session.role, "cashier") && session.role !== "admin")) {
    redirect("/login");
  }
  const [settings, menu] = await Promise.all([getSettings(), listMenu(outlet)]);
  return <CounterPageClient outlet={outlet} menu={menu} venueName={settings.venueName} />;
}
