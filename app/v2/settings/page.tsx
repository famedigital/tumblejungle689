import { redirect } from "next/navigation";

export default function V2SettingsPage() {
  redirect("/v2/admin?tab=settings");
}
