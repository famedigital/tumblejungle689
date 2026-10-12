"use client";

import Link from "next/link";

export function ReceiptActions() {
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
