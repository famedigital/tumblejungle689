"use client";

import { useEffect, useState } from "react";
import { JournalWatch } from "@/components/journal-watch";
import { PlaytabCredit } from "@/components/playtab-mark";
import { formatNu } from "@/lib/format";
import { isPoleHello, isPoleJournal, isPolePayload, poleHello, poleReadLast, POLE_CHANNEL, type PolePayload } from "@/lib/pole";

export function CustomerDisplay({ journalScan }: { journalScan: boolean }) {
  const [pole, setPole] = useState<PolePayload | null>(null);
  const [qrSrc, setQrSrc] = useState("");

  useEffect(() => {
    const last = poleReadLast();
    if (last) setPole(last);
    poleHello();
    const channel = new BroadcastChannel(POLE_CHANNEL);
    channel.onmessage = (event) => {
      if (isPoleHello(event.data) || isPoleJournal(event.data)) return;
      if (isPolePayload(event.data)) setPole(event.data);
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    if (!pole?.qr) {
      setQrSrc("");
      return;
    }
    let gone = false;
    void import("qrcode")
      .then((mod) =>
        mod.toDataURL(pole.qr, {
          margin: 1,
          width: 640,
          errorCorrectionLevel: "M",
          color: { dark: "#146047", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (!gone) setQrSrc(url);
      })
      .catch(() => {
        if (!gone) setQrSrc("");
      });
    return () => {
      gone = true;
    };
  }, [pole?.qr]);

  const shop = pole?.shop || "Tumble Jungle";
  const idle = !pole?.code && !pole?.thanks && !pole?.qr;
  const payAmount = pole && (pole.payNu ?? 0) > 0 ? pole.payNu : pole?.due ?? 0;

  return (
    <main data-surface="till" className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-end justify-between gap-4 px-6 pt-6 sm:px-8">
        <p className="font-heading text-3xl text-primary sm:text-4xl">{shop}</p>
        {pole?.code ? <p className="font-mono text-xl tracking-[0.16em]">{pole.code}</p> : null}
      </header>
      {idle ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="font-heading text-4xl text-primary sm:text-6xl">{shop}</p>
          <p className="text-lg text-muted-foreground">Scan and pay will show here</p>
        </div>
      ) : pole?.thanks ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="font-heading text-5xl text-primary sm:text-6xl">Paid</p>
          <p className="text-3xl tabular-nums">{formatNu(pole.due)}</p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)]">
          <ul className="min-h-0 space-y-2 overflow-auto">
            {(pole?.lines ?? []).map((line, index) => (
              <li key={`${line.name}-${index}`} className="flex items-baseline justify-between gap-4 border-b border-border py-3 text-2xl">
                <span className={line.paid ? "text-muted-foreground" : ""}>
                  {line.name}
                  {line.qty > 1 ? <span className="text-muted-foreground"> × {line.qty}</span> : null}
                </span>
                <span className="shrink-0 tabular-nums">{line.paid ? "Paid" : formatNu(line.amount)}</span>
              </li>
            ))}
          </ul>
          <aside className="flex flex-col items-center justify-center rounded-3xl bg-card px-6 py-8 text-center ring-1 ring-foreground/10">
            {pole && pole.due > 0 && qrSrc ? (
              <>
                <p className="text-sm tracking-[0.16em] text-muted-foreground uppercase">Scan and pay</p>
                <p className="mt-1 font-heading text-5xl text-primary tabular-nums sm:text-6xl">{formatNu(payAmount)}</p>
                {(pole.payNu ?? 0) > 0 && pole.payNu < pole.due ? (
                  <p className="mt-2 text-lg">Bill {formatNu(pole.due)} · cash {formatNu(pole.due - pole.payNu)}</p>
                ) : null}
                {pole.extra ? <p className="mt-2 max-w-sm text-lg">{pole.extra}</p> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt={`Scan and pay ${formatNu(payAmount)}`} className="mt-4 size-[min(70vw,22rem)] rounded-2xl bg-white p-3" />
                <p className="mt-3 text-lg">mBoB or your bank app</p>
                <JournalWatch active={journalScan} amountNu={payAmount} />
              </>
            ) : (
              <>
                <p className="text-sm tracking-[0.16em] text-muted-foreground uppercase">Due</p>
                <p className="mt-1 font-heading text-5xl text-primary tabular-nums sm:text-6xl">{formatNu(pole?.due ?? 0)}</p>
                <p className="mt-3 text-lg text-muted-foreground">Nothing to scan</p>
              </>
            )}
          </aside>
        </div>
      )}
      <PlaytabCredit className="px-6 pb-4 text-muted-foreground sm:px-8" />
    </main>
  );
}
