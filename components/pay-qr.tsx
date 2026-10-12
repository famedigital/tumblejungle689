"use client";

import { useEffect, useState } from "react";
import { buildDynamicEmv } from "@/lib/emv";
import { formatNu } from "@/lib/format";

export function PayQr({
  staticPayload,
  amountNu,
  note,
  compact = false,
}: {
  staticPayload: string;
  amountNu: number;
  note: string;
  compact?: boolean;
}) {
  const [src, setSrc] = useState("");
  const payload = buildDynamicEmv(staticPayload, amountNu, note);

  useEffect(() => {
    if (!payload) {
      setSrc("");
      return;
    }
    let gone = false;
    void import("qrcode")
      .then((mod) =>
        mod.toDataURL(payload, {
          margin: 1,
          width: 280,
          errorCorrectionLevel: "M",
          color: { dark: "#1f4d3a", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (!gone) setSrc(url);
      })
      .catch(() => {
        if (!gone) setSrc("");
      });
    return () => {
      gone = true;
    };
  }, [payload]);

  if (!staticPayload) {
    return (
      <p className="text-sm text-muted-foreground">
        No bank QR is saved yet. Take cash, or upload the venue bank QR on the Bank page.
      </p>
    );
  }
  if (amountNu <= 0) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Bank QR for ${formatNu(amountNu)}`} className={`${compact ? "size-36" : "size-52"} rounded-lg bg-white p-2`} />
      ) : (
        <div className={`${compact ? "size-36" : "size-52"} animate-pulse rounded-lg bg-muted`} />
      )}
      <p className="text-sm font-medium">{formatNu(amountNu)} on the bank QR</p>
    </div>
  );
}
