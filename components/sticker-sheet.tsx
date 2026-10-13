"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
      <header className="no-print sticker-tools">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Visit {code}</p>
          <h1 className="font-heading text-3xl text-primary">Play stickers</h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            {kids === 1 ? "1 child" : `${kids} children`} · {phone}. Each label is this visit. Scan it to add food or more play time.
          </p>
        </div>
        <div className="sticker-actions">
          <div className="sticker-choice" role="tablist" aria-label="How many stickers">
            <button type="button" aria-selected={!parents} onClick={() => setParents(false)}>
              {kids} {kids === 1 ? "sticker" : "stickers"}
            </button>
            <button type="button" aria-selected={parents} onClick={() => setParents(true)}>
              {kids + 1} with a parent
            </button>
          </div>
          <Button type="button" className="h-11 px-4" onClick={printStickers}>
            Print
          </Button>
          <Button variant="outline" className="h-11 px-4" asChild>
            <Link href={back}>Back</Link>
          </Button>
        </div>
      </header>
      <section className="sticker-desk" aria-label="Sticker preview">
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
      </section>
    </main>
  );
}
