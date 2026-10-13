"use client";

import { useEffect, useRef } from "react";
import { formatNu, formatPhone, formatWhen } from "@/lib/format";
import type { RecentTxn } from "@/lib/types";

const KIND: Record<string, string> = {
  playtime: "Play",
  extension: "Extra play",
  food: "Food",
  void: "Void",
  waive: "Waived",
  leave: "Left",
};

const STATION: Record<string, string> = {
  desk: "Front desk",
  cafe: "Cafe",
  restaurant: "Restaurant",
  cashier: "Cashier",
};

export function RecentSheet({
  recent,
  selected,
  onSelect,
  onOpen,
  onClose,
}: {
  recent: RecentTxn[];
  selected: number;
  onSelect: (index: number) => void;
  onOpen: (code: string) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const row = recent[selected] ?? null;

  useEffect(() => {
    const node = listRef.current?.querySelector("[aria-current='true']");
    if (node instanceof HTMLElement) node.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <div className="cash-scrim" role="presentation" onClick={onClose}>
      <div
        className="cash-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Recent transactions"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cash-sheet-bar">
          <p>Recent</p>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="cash-hint">Today’s payments, voids, and closes. Up and down move. Enter opens the receipt.</p>
        {recent.length === 0 ? (
          <p className="cash-hint">No payments yet today.</p>
        ) : (
          <ul ref={listRef} className="cash-recent">
            {recent.map((item, index) => (
              <li key={`${item.kind}-${item.id}-${item.createdAt}`}>
                <button
                  type="button"
                  aria-current={index === selected ? "true" : undefined}
                  onClick={() => {
                    onSelect(index);
                    onOpen(item.code);
                  }}
                  onMouseEnter={() => onSelect(index)}
                >
                  <span>
                    <strong>
                      {formatPhone(item.phone)} · {item.code}
                    </strong>
                    <small>
                      {formatWhen(item.createdAt)} · {KIND[item.kind] ?? item.kind}
                      {item.method === "bank_qr" ? " · Bank QR" : item.method === "cash" ? " · Cash" : ""}
                      {item.staffName ? ` · ${item.staffName}` : ` · ${STATION[item.station] ?? item.station}`}
                      {item.status === "open" ? " · Open" : ""}
                    </small>
                  </span>
                  <b>{formatNu(item.amountNu)}</b>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="cash-go" style={{ padding: "1rem 1.25rem 1.25rem" }}>
          <button type="button" className="cash-cash" disabled={!row} onClick={() => row && onOpen(row.code)}>
            Open receipt
          </button>
        </div>
      </div>
    </div>
  );
}
