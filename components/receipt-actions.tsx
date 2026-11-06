"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function printReceipt() {
  document.body.dataset.print = "receipt";
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    delete document.body.dataset.print;
    window.removeEventListener("afterprint", finish);
  };
  window.addEventListener("afterprint", finish);
  window.setTimeout(finish, 4000);
  window.print();
}

export function ReceiptActions() {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.key === "Enter") {
        event.preventDefault();
        printReceipt();
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
      <button type="button" className="receipt-print" onClick={() => printReceipt()}>
        Print
      </button>
      <Link href="/cashier" className="receipt-back">
        Back to cashier
      </Link>
    </div>
  );
}
