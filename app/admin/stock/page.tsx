import { Flash } from "@/components/flash";
import { StockHub } from "@/components/stock-hub";
import { StaffShell } from "@/components/staff-shell";
import { requireArea } from "@/lib/auth";
import { listMenu, listRecentPurchases, listStockItems } from "@/lib/domain";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await requireArea("admin");
  const query = await searchParams;
  const [tracked, catalog, purchases] = await Promise.all([
    listStockItems(),
    listMenu(undefined, true),
    listRecentPurchases(15),
  ]);

  return (
    <StaffShell role={session.role} name={session.name} title="Stock" tone="candy" current="stock">
      <Flash error={query.error} ok={query.ok} />
      <StockHub tracked={tracked} catalog={catalog} purchases={purchases} />
    </StaffShell>
  );
}
