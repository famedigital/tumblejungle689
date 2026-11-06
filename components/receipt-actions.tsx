"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { thermalPrint } from "@/lib/print-station";

export function ReceiptActions() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function printReceipt() {
    if (busy) return;
    setBusy(true);
    setStatus("Sending…");
    try {
      const result = await thermalPrint("receipt");
      setStatus(result === "station" ? "Sent to shared printer." : "Opened device print dialog.");
    } catch {
      setStatus("Print failed.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatus(""), 4000);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.key === "Enter") {
        event.preventDefault();
        void printReceipt();
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      router.push("/cashier");
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [router, busy]);

  return (
    <div className="no-print flex flex-wrap items-center gap-3">
      <button type="button" className="receipt-print" disabled={busy} onClick={() => void printReceipt()}>
        {busy ? "Sending…" : "Print"}
      </button>
      <Link href="/cashier" className="receipt-back">
        Back to cashier
      </Link>
      {status ? <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{status}</p> : null}
    </div>
  );
}
