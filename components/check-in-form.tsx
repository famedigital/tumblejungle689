"use client";

import { useState } from "react";
import { checkInAction } from "@/app/actions";
import { PayQr } from "@/components/pay-qr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNu } from "@/lib/format";
import type { Rate } from "@/lib/types";

export function CheckInForm({
  rates,
  staticPayload,
}: {
  rates: Rate[];
  staticPayload: string;
}) {
  const [minutes, setMinutes] = useState(rates[0]?.minutes ?? 60);
  const [method, setMethod] = useState<"cash" | "bank_qr">("cash");
  const rate = rates.find((item) => item.minutes === minutes) ?? rates[0];

  return (
    <form action={checkInAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" name="phone" inputMode="numeric" autoComplete="tel" required className="h-12 text-lg" placeholder="8 digits" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="name">Parent name</Label>
          <Input id="name" name="name" autoComplete="name" className="h-12 text-base" placeholder="Optional" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="childCount">Children playing</Label>
          <Input id="childCount" name="childCount" type="number" min={1} max={12} defaultValue={1} required className="h-12 text-base" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Play time</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rates.map((item) => (
            <label
              key={item.minutes}
              className={`cursor-pointer rounded-xl border px-3 py-3 ${
                minutes === item.minutes ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="minutes"
                value={item.minutes}
                checked={minutes === item.minutes}
                onChange={() => setMinutes(item.minutes)}
              />
              <span className="block font-heading text-lg">{item.minutes} min</span>
              <span className="text-sm text-muted-foreground">{formatNu(item.amountNu)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Take playtime payment now</legend>
        <div className="flex gap-2">
          <label className={`cursor-pointer rounded-lg border px-3 py-2 ${method === "cash" ? "border-primary bg-primary/10" : "border-border"}`}>
            <input className="sr-only" type="radio" name="method" value="cash" checked={method === "cash"} onChange={() => setMethod("cash")} />
            Cash
          </label>
          <label className={`cursor-pointer rounded-lg border px-3 py-2 ${method === "bank_qr" ? "border-primary bg-primary/10" : "border-border"}`}>
            <input className="sr-only" type="radio" name="method" value="bank_qr" checked={method === "bank_qr"} onChange={() => setMethod("bank_qr")} />
            Bank QR
          </label>
        </div>
        {method === "bank_qr" && rate ? (
          <PayQr staticPayload={staticPayload} amountNu={rate.amountNu} note={`Play ${rate.minutes}m`} />
        ) : null}
      </fieldset>

      <Button type="submit" className="h-12 px-6 text-base">
        Payment received, issue ticket
      </Button>
    </form>
  );
}
