import { redirect } from "next/navigation";

export default function V2MenuPage() {
  redirect("/v2/admin?tab=menu");
}
