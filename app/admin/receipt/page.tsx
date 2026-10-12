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
  const settings = getSettings();

  return (
    <StaffShell role={session.role} name={session.name} title="Receipt" tone="candy" current="/admin/receipt">
      <Flash error={query.error} ok={query.ok} />
      <ReceiptEditor
        venue={settings.venueName}
        address={settings.address}
        note={settings.receiptNote}
        thanks={settings.receiptThanks}
        rules={settings.receiptRules}
      />
    </StaffShell>
  );
}
