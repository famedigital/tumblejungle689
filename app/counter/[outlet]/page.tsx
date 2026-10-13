import { notFound, redirect } from "next/navigation";

export default async function CounterPage({
  params,
  searchParams,
}: {
  params: Promise<{ outlet: string }>;
  searchParams: Promise<{ q?: string; error?: string; ok?: string }>;
}) {
  const { outlet } = await params;
  if (outlet !== "cafe" && outlet !== "restaurant") notFound();
  const query = await searchParams;
  const next = new URLSearchParams();
  if (query.q) next.set("q", query.q);
  if (query.error) next.set("error", query.error);
  if (query.ok) next.set("ok", query.ok);
  const search = next.toString();
  redirect(search ? `/cashier?${search}` : "/cashier");
}
