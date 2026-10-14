"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ReceiptActions() {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.key === "Enter") {
        event.preventDefault();
        window.print();
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      router.push("/cashier");
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [router]);

  return (
    <div className="no-print">
      <button type="button" className="receipt-print" onClick={() => window.print()}>
        Print
      </button>
      <Link href="/cashier" className="receipt-back">
        Back to cashier
      </Link>
    </div>
  );
}
