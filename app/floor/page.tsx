import { redirect } from "next/navigation";
import { FloorPageClient } from "@/components/floor/floor-page-client";
import { getSession } from "@/lib/auth";
import { getSettings, listOpenVisits } from "@/lib/domain";

export default async function FloorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [settings, open] = await Promise.all([getSettings(), listOpenVisits()]);
  const visits = open.map((visit) => ({
    code: visit.code,
    guardianName: visit.guardianName,
    childCount: visit.childCount,
    paidUntil: visit.paidUntil,
    phone: visit.phone,
    dueNu: visit.dueNu,
  }));
  return <FloorPageClient visits={visits} venueName={settings.venueName} capacity={40} />;
}
