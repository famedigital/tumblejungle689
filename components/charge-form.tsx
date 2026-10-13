"use client";

import { useState } from "react";
import { saveChargesAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function ChargeForm({
  scOn,
  scPercent,
  gstOn,
  gstPercent,
}: {
  scOn: boolean;
  scPercent: number;
  gstOn: boolean;
  gstPercent: number;
}) {
  const [service, setService] = useState(scOn);
  const [gst, setGst] = useState(gstOn);

  return (
    <form action={saveChargesAction} className="grid max-w-md gap-4">
      <input type="hidden" name="scOn" value={service ? "1" : "0"} />
      <input type="hidden" name="gstOn" value={gst ? "1" : "0"} />
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-background px-4 py-3 ring-1 ring-foreground/10">
        <div>
          <p className="font-medium">Service charge</p>
          <p className="text-sm text-muted-foreground">Added on the cashier bill.</p>
        </div>
        <Switch checked={service} onCheckedChange={setService} aria-label="Service charge" />
      </div>
      <label className="grid gap-1 text-sm">
        <span>S.C. percent</span>
        <Input name="scPercent" type="number" inputMode="decimal" min={0} max={30} step="0.01" defaultValue={scPercent} className="h-11" required />
      </label>
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-background px-4 py-3 ring-1 ring-foreground/10">
        <div>
          <p className="font-medium">GST</p>
          <p className="text-sm text-muted-foreground">Worked out after service charge.</p>
        </div>
        <Switch checked={gst} onCheckedChange={setGst} aria-label="GST" />
      </div>
      <label className="grid gap-1 text-sm">
        <span>GST percent</span>
        <Input name="gstPercent" type="number" inputMode="decimal" min={0} max={30} step="0.01" defaultValue={gstPercent} className="h-11" required />
      </label>
      <Button type="submit" className="h-11 w-fit">
        Save charges
      </Button>
    </form>
  );
}
