import { ProductHub } from "@/components/product-hub";
import { Flash } from "@/components/flash";
import { StaffShell } from "@/components/staff-shell";
import { requireArea } from "@/lib/auth";
import { catalogToday, getSettings, listCategories, listMenu } from "@/lib/domain";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; desk?: string }>;
}) {
  const session = await requireArea("admin");
  const query = await searchParams;
  const settings = getSettings();
  const today = catalogToday();

  return (
    <StaffShell role={session.role} name={session.name} title="Products" tone="candy" current="/admin/products">
      <Flash error={query.error} ok={query.ok} />
      <ProductHub
        rates={settings.rates}
        menu={listMenu(undefined, true)}
        categories={listCategories().map((category) => ({
          id: category.id,
          name: category.name,
          outlet: category.outlet,
        }))}
        soldDishes={today.dishes}
        soldPlay={today.play}
        desk={query.desk}
        ratesAreSamples={settings.ratesAreSamples}
        menuIsSample={settings.menuIsSample}
      />
    </StaffShell>
  );
}
