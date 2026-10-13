import { CustomerDisplay } from "@/components/customer-display";
import { getSettings } from "@/lib/domain";

export default async function CustomerDisplayPage() {
  const settings = await getSettings();
  return <CustomerDisplay journalScan={settings.journalScan} />;
}
