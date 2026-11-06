import { redirect } from "next/navigation";

export default function AdminReceiptRedirect() {
  redirect("/v2/admin?tab=settings");
}
