"use client";

import { useState } from "react";
import { saveRatesAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Rate } from "@/lib/types";

export function RatesForm({ rates }: { rates: Rate[] }) {
  const [rows, setRows] = useState<Rate[]>(rates.length ? rates : [{ minutes: 60, amountNu: 0 }]);

  function update(index: number, patch: Partial<Rate>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form action={saveRatesAction} className="space-y-3">
      <input type="hidden" name="rates" value={JSON.stringify(rows)} />
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`minutes-${index}`}>Minutes</Label>
            <Input
              id={`minutes-${index}`}
              type="number"
              min={30}
              max={120}
              value={row.minutes}
              onChange={(event) => update(index, { minutes: Number(event.target.value) })}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`amount-${index}`}>Nu</Label>
            <Input
              id={`amount-${index}`}
              type="number"
              min={0}
              value={row.amountNu}
              onChange={(event) => update(index, { amountNu: Number(event.target.value) })}
              className="h-11"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
          >
            Remove
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => setRows((current) => [...current, { minutes: 30, amountNu: 0 }])}
        >
          Add rate
        </Button>
        <Button type="submit" className="h-11">
          Save rates
        </Button>
      </div>
    </form>
  );
}
