"use client";

import { useState } from "react";
import { savePrintStationAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enqueueTestPrint, pingPrintStation, writePrintStationConfig } from "@/lib/print-station";

export function PrintStationForm({ token, on }: { url?: string; token: string; on?: boolean }) {
  const [draftToken, setDraftToken] = useState(token || "tumble-print");
  const [draftOn, setDraftOn] = useState(Boolean(on));
  const [ping, setPing] = useState("");

  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <div>
        <h2 className="font-heading text-2xl">Print station</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Phones cannot talk to a printer over WiFi from this secure website. Instead, the printer PC runs a small
          agent that <strong>pulls</strong> jobs from the cloud — no firewall port opening needed.
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>On the printer PC install Node.js LTS from nodejs.org</li>
        <li>
          Copy folder <code className="text-xs">tools/print-agent</code>, edit <code className="text-xs">.env</code>
        </li>
        <li>
          Set <code className="text-xs">CLOUD_URL=https://tumblejungle689.vercel.app</code> and the same token below
        </li>
        <li>
          Run <code className="text-xs">npm start</code> and leave the window open
        </li>
      </ol>
      <form
        action={savePrintStationAction}
        className="grid gap-3"
        onSubmit={() => {
          writePrintStationConfig({ token: draftToken, on: draftOn });
        }}
      >
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="printAgentOn"
            value="1"
            checked={draftOn}
            onChange={(event) => setDraftOn(event.target.checked)}
            className="size-4"
          />
          <span>Send till prints to the shared printer PC</span>
        </label>
        <label className="space-y-1 text-sm">
          <span>Shared token (must match agent .env TOKEN)</span>
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
              setPing("Checking…");
              const status = await pingPrintStation();
              if (status.online) {
                setPing(
                  `Agent online (seen ${status.ageSec ?? 0}s ago)${status.queued ? ` · ${status.queued} waiting` : ""}.`,
                );
              } else {
                setPing(
                  "Agent not seen yet. On the printer PC: 1) open Start Print Agent.bat 2) wait for “Connected to cloud” 3) Test again. If the window shows Poll error / Bad print token, match TOKEN with this page and Save first.",
                );
              }
            }}
          >
            Test agent
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={async () => {
              setPing("Sending test slip…");
              const result = await enqueueTestPrint();
              setPing(
                result.ok
                  ? "Test slip queued — watch the agent window and the printer."
                  : result.error || "Test print failed.",
              );
            }}
          >
            Send test print
          </Button>
        </div>
        {ping ? <p className="text-sm text-muted-foreground">{ping}</p> : null}
      </form>
    </section>
  );
}
