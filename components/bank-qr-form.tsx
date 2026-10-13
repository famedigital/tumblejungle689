"use client";

import { useState } from "react";
import { saveBankAction, saveJournalScanAction } from "@/app/actions";
import { PayQr } from "@/components/pay-qr";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { parseEmv, toStaticEmv } from "@/lib/emv";

export function BankQrForm({
  payload,
  account,
  payee,
  city,
  journalScan,
}: {
  payload: string;
  account: string;
  payee: string;
  city: string;
  journalScan: boolean;
}) {
  const [text, setText] = useState(payload);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [readName, setReadName] = useState(payee);
  const [readCity, setReadCity] = useState(city);
  const ready = Boolean(toStaticEmv(text));

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    const url = URL.createObjectURL(file);
    setImage((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      const normalized = toStaticEmv(result.getText());
      if (!normalized) {
        setError("That image is not a bank payment QR. Upload the QR from mBoB or your bank app.");
        return;
      }
      const map = parseEmv(normalized);
      setText(normalized);
      setReadName(map.get("59") || payee);
      setReadCity(map.get("60") || city);
    } catch {
      setError("Could not read a QR in that image. Use a clear photo or screenshot of the bank QR.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid items-start gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form action={saveBankAction} className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <input type="hidden" name="back" value="/admin/bank" />
        <input type="hidden" name="payload" value={text} />
        <input type="hidden" name="account" value={account} />
        <input type="hidden" name="payee" value={readName} />
        <input type="hidden" name="city" value={readCity} />
        <div>
          <h2 className="font-heading text-2xl">Bank QR</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a photo or screenshot of the venue bank QR. The code inside the picture is saved, and the counters stamp the amount due onto it. Nothing is sent to a bank from this computer.
          </p>
        </div>
        <label className="flex h-11 w-fit cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          {busy ? "Reading QR…" : ready && image ? "Replace bank QR" : "Upload bank QR"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onFile(file);
            }}
          />
        </label>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="Uploaded bank QR" className="size-40 rounded-lg bg-white object-contain p-2 ring-1 ring-foreground/10" />
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {ready ? (
          <p className="text-sm text-muted-foreground">
            {image ? "QR read." : "A bank QR is already saved. Upload a new image to replace it."}
            {readName ? ` Payee ${readName}.` : ""}
            {readCity ? ` ${readCity}.` : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No bank QR is saved yet.</p>
        )}
        <Button type="submit" className="h-11" disabled={!ready || busy}>
          Save bank QR
        </Button>
      </form>
      <aside className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-xl">Preview</h2>
        <p className="text-sm text-muted-foreground">A Nu 100 sample of the QR the counters will show.</p>
        <PayQr staticPayload={toStaticEmv(text)} amountNu={100} note="Preview" />
      </aside>
      </div>
      <JournalScanForm enabled={journalScan} />
    </section>
  );
}

function JournalScanForm({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  return (
    <form action={saveJournalScanAction} className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <input type="hidden" name="back" value="/admin/bank" />
      <input type="hidden" name="journalScan" value={on ? "1" : "0"} />
      <div>
        <h2 className="font-heading text-2xl">Journal scan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          When this is on, the customer screen watches the bank success page for a Jrnl or RRNO while a payment QR is showing. The cashier can still type the number. Payments work either way.
        </p>
      </div>
      <label className="flex h-12 items-center justify-between gap-4 rounded-xl bg-muted px-4">
        <span className="text-sm font-medium">{on ? "Journal scan on" : "Journal scan off"}</span>
        <Switch checked={on} onCheckedChange={setOn} aria-label="Journal scan" />
      </label>
      <Button type="submit" className="h-11">
        Save journal scan
      </Button>
    </form>
  );
}
