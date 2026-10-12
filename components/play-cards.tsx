"use client";

import { useState } from "react";
import { formatNu } from "@/lib/format";
import type { Rate } from "@/lib/types";

const LOOKS = [
  { wash: "bg-[#ffe8a3]", ink: "text-[#6a4b00]", chip: "bg-[#ffb703]" },
  { wash: "bg-[#b7ebe3]", ink: "text-[#0f4f45]", chip: "bg-[#2a9d8f]" },
  { wash: "bg-[#b9e8ff]", ink: "text-[#0c4a6e]", chip: "bg-[#38bdf8]" },
  { wash: "bg-[#ffc9c0]", ink: "text-[#7f1d1d]", chip: "bg-[#ef6f5e]" },
];

export function PlayCards({ rates }: { rates: Rate[] }) {
  const [open, setOpen] = useState<number | null>(rates[1]?.minutes ?? rates[0]?.minutes ?? null);

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {rates.map((rate, index) => {
        const look = LOOKS[index % LOOKS.length];
        const selected = open === rate.minutes;
        return (
          <li key={rate.minutes}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => setOpen(selected ? null : rate.minutes)}
              className={`w-full rounded-3xl p-5 text-left transition hover:-translate-y-1 hover:shadow-lg ${look.wash} ${look.ink} ${selected ? "ring-2 ring-[#1f4d3a]" : ""}`}
            >
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white ${look.chip}`}>
                {rate.minutes < 60 ? "Quick tumble" : rate.minutes === 60 ? "Favourite" : rate.minutes >= 120 ? "Long stay" : "Extra play"}
              </span>
              <span className="mt-3 block font-heading text-4xl">{rate.minutes}</span>
              <span className="block text-sm">minutes</span>
              <span className="mt-3 block text-lg font-medium">{formatNu(rate.amountNu)}</span>
              {selected ? (
                <span className="mt-3 block text-sm leading-relaxed">
                  Paid at the desk before play starts. One QR ticket stays with the family until you leave.
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
