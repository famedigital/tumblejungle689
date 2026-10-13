import { BankQrForm } from "@/components/bank-qr-form";
import { Flash } from "@/components/flash";
import { StaffShell } from "@/components/staff-shell";
import { requireArea } from "@/lib/auth";
import { getSettings } from "@/lib/domain";

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await requireArea("admin");
  const query = await searchParams;
  const settings = await getSettings();

  return (
    <StaffShell role={session.role} name={session.name} title="Bank" tone="candy" current="bank">
      <Flash error={query.error} ok={query.ok} />
      <BankQrForm
        payload={settings.bankPayload}
        account={settings.bankAccount}
        payee={settings.payee}
        city={settings.city}
        journalScan={settings.journalScan}
      />
    </StaffShell>
  );
}
