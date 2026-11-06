"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlayPass } from "@/components/play-pass";
import { formatPhone } from "@/lib/format";

export function StickerSheet({
  venue,
  code,
  phone,
  qr,
  childCount,
  children: legacyChildren,
  started,
  ends,
  back,
}: {
  venue: string;
  code: string;
  phone: string;
  qr: string;
  childCount?: number;
  children?: number;
  started: string;
  ends: string;
  back: string;
}) {
  const count = childCount ?? legacyChildren ?? 1;
  const kids = Math.max(0, count);

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
          <h1>Play pass</h1>
          <p>
            {kids === 1 ? "1 child" : `${kids} children`} · {formatPhone(phone)}
          </p>
        </div>
        <div className="sticker-actions">
          <Button type="button" className="h-11 px-4" onClick={printStickers}>
            Reprint QR
          </Button>
          <Button variant="outline" className="h-11 px-4" asChild>
            <Link href={back}>Back</Link>
          </Button>
        </div>
      </header>
      <section className="sticker-desk" aria-label="Play pass preview">
        <PlayPass venue={venue} code={code} phone={phone} qr={qr} childCount={kids} started={started} ends={ends} />
        <p className="no-print sticker-note">Prints on 80mm paper. Scan it at the till to open this visit.</p>
      </section>
    </main>
  );
}
