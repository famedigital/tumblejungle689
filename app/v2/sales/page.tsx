import { redirect } from "next/navigation";

export default function V2SalesPage() {
  redirect("/v2/admin?tab=sales");
}
