import { redirect } from "next/navigation";

export default function AdminStockRedirect() {
  redirect("/v2/admin?tab=stock");
}
