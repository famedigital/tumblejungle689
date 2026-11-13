import { redirect } from "next/navigation";

/** Archived v1 till — all stations use /v2. */
export default async function CashierPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; print?: string; hold?: string; new?: string }>;
}) {
  const query = await searchParams;
  const next = new URLSearchParams();
  if (query.q) next.set("q", query.q);
  if (query.new === "1") next.set("admit", "1");
  if (query.hold === "1") next.set("hold", "1");
  const qs = next.toString();
  redirect(qs ? `/v2?${qs}` : "/v2");
}
