"use client";

import { useState } from "react";
import { savePrintStationAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pingPrintStation, writePrintStationConfig } from "@/lib/print-station";

export function PrintStationForm({ url, token }: { url: string; token: string }) {
  const [draftUrl, setDraftUrl] = useState(url);
  const [draftToken, setDraftToken] = useState(token || "tumble-print");
  const [ping, setPing] = useState("");

  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <div>
        <h2 className="font-heading text-2xl">Print station</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run <code className="text-xs">tools/print-agent</code> on the PC that owns the thermal printer. Phones on the
          same WiFi print through that PC. Leave URL blank to use each device&apos;s own browser print dialog.
        </p>
      </div>
      <form
        action={savePrintStationAction}
        className="grid gap-3"
        onSubmit={() => {
          writePrintStationConfig({ url: draftUrl, token: draftToken });
        }}
      >
        <label className="space-y-1 text-sm">
          <span>Agent URL</span>
          <Input
            name="printAgentUrl"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            placeholder="http://192.168.1.20:7910"
            className="h-11"
            autoComplete="off"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Shared token</span>
          <Input
            name="printAgentToken"
            value={draftToken}
            onChange={(event) => setDraftToken(event.target.value)}
            placeholder="tumble-print"
            className="h-11"
            autoComplete="off"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11">
            Save print station
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={async () => {
              const clean = draftUrl.trim().replace(/\/$/, "");
              if (!clean) {
                setPing("Enter the PC agent URL first.");
                return;
              }
              setPing("Checking…");
              const ok = await pingPrintStation({ url: clean, token: draftToken });
              setPing(ok ? "Agent reachable on this WiFi." : "Cannot reach agent — check PC IP, firewall, and npm start.");
            }}
          >
            Test connection
          </Button>
        </div>
        {ping ? <p className="text-sm text-muted-foreground">{ping}</p> : null}
      </form>
    </section>
  );
}
