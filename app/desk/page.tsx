import { redirect } from "next/navigation";
import { DeskPageClient } from "@/components/desk/desk-page-client";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/domain";
import { can } from "@/lib/types";

export default async function DeskPage() {
  const session = await getSession();
  if (!session || (!can(session.role, "desk") && !can(session.role, "cashier"))) {
    redirect("/login");
  }
  const settings = await getSettings();
  return <DeskPageClient rates={settings.rates} venueName={settings.venueName} />;
}
