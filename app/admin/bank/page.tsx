import { redirect } from "next/navigation";

export default function AdminBankRedirect() {
  redirect("/v2/admin?tab=settings");
}
