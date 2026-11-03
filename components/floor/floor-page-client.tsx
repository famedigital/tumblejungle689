"use client";

import { useRouter } from "next/navigation";
import { FloorRadarView, type FloorVisit } from "@/components/floor/FloorRadarView";
import { EnterpriseShell } from "@/components/shell/EnterpriseShell";

export function FloorPageClient({
  visits,
  capacity = 40,
  venueName,
}: {
  visits: FloorVisit[];
  capacity?: number;
  venueName: string;
}) {
  const router = useRouter();
  const jumpers = visits.reduce((sum, visit) => sum + Math.max(1, visit.childCount), 0);

  return (
    <EnterpriseShell outletLabel="Play Floor" activeJumpers={jumpers} capacity={capacity}>
      <FloorRadarView
        visits={visits}
        capacity={capacity}
        venueName={venueName}
        onExtend={(code) => {
          router.push(`/cashier?q=${encodeURIComponent(code)}`);
        }}
        onLeave={(code) => {
          router.push(`/cashier?q=${encodeURIComponent(code)}`);
        }}
      />
    </EnterpriseShell>
  );
}
