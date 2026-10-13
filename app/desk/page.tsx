import { redirect } from "next/navigation";

export default async function DeskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; q?: string }>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.error) next.set("error", params.error);
  if (params.ok) next.set("ok", params.ok);
  const query = next.toString();
  redirect(query ? `/cashier?${query}` : "/cashier");
}
