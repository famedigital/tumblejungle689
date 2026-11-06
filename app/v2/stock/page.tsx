import { redirect } from "next/navigation";

export default function V2StockPage() {
  redirect("/v2/admin?tab=stock");
}
