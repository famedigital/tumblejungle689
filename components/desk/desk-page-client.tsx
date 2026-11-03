"use client";

import { checkInAction } from "@/app/actions";
import { FastAdmissionWizard, type AdmissionIssueData } from "@/components/desk/FastAdmissionWizard";
import { EnterpriseShell } from "@/components/shell/EnterpriseShell";
import type { Rate } from "@/lib/types";

export interface DeskPageClientProps {
  rates: Rate[];
  venueName: string;
}

export function DeskPageClient({ rates }: DeskPageClientProps) {
  async function handleIssue(data: AdmissionIssueData) {
    const form = new FormData();
    form.set("back", "/desk");
    form.set("phone", data.phone);
    form.set("name", data.name);
    form.set("childCount", String(data.children));
    form.set("minutes", String(data.minutes));
    form.set("method", "cash");
    await checkInAction(form);
  }

  return (
    <EnterpriseShell outletLabel="Frontdesk">
      <FastAdmissionWizard rates={rates} onIssue={handleIssue} />
    </EnterpriseShell>
  );
}
