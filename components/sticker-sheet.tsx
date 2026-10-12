"use client";

import { useState } from "react";
import Link from "next/link";

export function StickerSheet({
  venue,
  code,
  phone,
  qr,
  children,
  back,
}: {
  venue: string;
  code: string;
  phone: string;
  qr: string;
  children: number;
  back: string;
}) {
  const [parents, setParents] = useState(false);
  const kids = Math.max(1, children);
  const labels = [
    ...Array.from({ length: kids }, (_, index) => (kids === 1 ? "Child" : `Child ${index + 1}`)),
    ...(parents ? ["Parent"] : []),
  ];

  function printStickers() {
    document.body.dataset.print = "sticker";
    const done = () => {
      delete document.body.dataset.print;
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }

  return (
    <main className="sticker-page">
      <div className="no-print sticker-tools">
        <div>
          <h1 className="font-heading text-3xl text-[var(--river)]">Play stickers</h1>
          <p className="mt-1 max-w-md text-sm text-[var(--ink-mute)]">
            {kids === 1 ? "1 child" : `${kids} children`}. Each sticker is the same visit. Scan it at the cafe, restaurant, or cashier to add food or more play time.
          </p>
        </div>
        <div className="sticker-choice" role="tablist" aria-label="How many stickers">
          <button type="button" aria-selected={!parents} onClick={() => setParents(false)}>
            {kids} {kids === 1 ? "sticker" : "stickers"}
          </button>
          <button type="button" aria-selected={parents} onClick={() => setParents(true)}>
            {kids + 1} with a parent
          </button>
        </div>
        <div className="sticker-actions">
          <button type="button" className="receipt-print" onClick={printStickers}>
            Print
          </button>
          <Link href={back} className="receipt-back">
            Back
          </Link>
        </div>
      </div>
      <div className="print-sticker-sheet">
        {labels.map((label, index) => (
          <article key={`${label}-${index}`} className="print-sticker">
            <p>{venue}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="" />
            <p className="sticker-code">{code}</p>
            <p className="sticker-who">{label}</p>
            <p>{phone}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
