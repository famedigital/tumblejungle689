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
        <div className="sticker-id">
          <p>Visit {code}</p>
          <h1>Play stickers</h1>
          <p>
            {kids === 1 ? "1 child" : `${kids} children`} · {phone}
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
        <p className="no-print sticker-note">Scan a sticker at the till to open this visit.</p>
      </section>
    </main>
  );
}
