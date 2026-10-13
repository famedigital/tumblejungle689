"use client";

import { PAY_BANKS } from "@/lib/pay-banks";

export function BankPick({ value, onChange }: { value: string; onChange: (label: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Bank">
      {PAY_BANKS.map((bank) => {
        const on = value === bank.label;
        return (
          <button
            key={bank.id}
            type="button"
            aria-pressed={on}
            className={`h-8 rounded-md px-2 text-[11px] font-bold tracking-wide ${
              on ? "bg-neutral-950 text-white" : "bg-background text-foreground ring-1 ring-foreground/20"
            }`}
            onClick={() => onChange(bank.label)}
          >
            {bank.label}
          </button>
        );
      })}
    </div>
  );
}
