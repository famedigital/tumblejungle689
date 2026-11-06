import { redirect } from "next/navigation";

export default function AdminProductsRedirect() {
  redirect("/v2/admin?tab=menu");
}
