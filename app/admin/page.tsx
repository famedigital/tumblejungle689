import { redirect } from "next/navigation";

export default function AdminRootRedirect() {
  redirect("/v2/admin");
}
