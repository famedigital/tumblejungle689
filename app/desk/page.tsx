import { redirect } from "next/navigation";

/** Archived: frontdesk lives on /cashier for now. */
export default function DeskPage() {
  redirect("/cashier");
}
