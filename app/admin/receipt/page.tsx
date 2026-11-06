import { PrintStationForm } from "@/components/print-station-form";
import { ReceiptEditor } from "@/components/receipt-editor";
import { Flash } from "@/components/flash";
import { StaffShell } from "@/components/staff-shell";
import { requireArea } from "@/lib/auth";
import { getSettings } from "@/lib/domain";

export default async function ReceiptDesignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await requireArea("admin");
  const query = await searchParams;
  const settings = await getSettings();

  return (
    <StaffShell role={session.role} name={session.name} title="Receipt" tone="candy" current="receipt">
      <Flash error={query.error} ok={query.ok} />
      <div className="grid gap-4">
        <PrintStationForm token={settings.printAgentToken} on={settings.printAgentOn} />
        <ReceiptEditor
          venue={settings.venueName}
          address={settings.address}
          note={settings.receiptNote}
          thanks={settings.receiptThanks}
          rules={settings.receiptRules}
        />
      </div>
    </StaffShell>
  );
}
