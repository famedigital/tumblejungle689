import { CashierTouch } from "@/components/cashier-touch";
import { requireArea } from "@/lib/auth";

export default async function CashierPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; ok?: string; print?: string; hold?: string; new?: string }>;
}) {
  const session = await requireArea("cashier");
  const query = await searchParams;
  return (
    <CashierTouch
      staffName={session.name}
      error={query.error}
      ok={query.ok}
      query={query.q}
      printTicket={query.print === "ticket"}
      printReceipt={query.print === "receipt"}
      printPack={query.print === "pack"}
      holdOpen={query.hold === "1"}
      startNew={query.new === "1"}
    />
  );
}
