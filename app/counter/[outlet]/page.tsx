import { redirect } from "next/navigation";

/** Archived: cafe/restaurant ordering lives on /cashier for now. */
export default function CounterPage() {
  redirect("/cashier");
}
