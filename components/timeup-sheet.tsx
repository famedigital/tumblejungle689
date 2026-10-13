"use client";

import { useEffect, useState } from "react";
import { formatPhone } from "@/lib/format";
import { whatsAppChat } from "@/lib/whatsapp";
import type { VisitView } from "@/lib/types";

export function TimeUpSheet({
  rows,
  venue,
  sentIds,
  onSent,
  onOpen,
  onClose,
}: {
  rows: { item: VisitView; left: number }[];
  venue: string;
  sentIds: number[];
  onSent: (id: number) => void;
  onOpen: (code: string) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(rows[0]?.item.id ?? null);
  const selected = rows.find((row) => row.item.id === selectedId) ?? rows[0] ?? null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (!rows.length || !selected) return;
      const index = Math.max(0, rows.findIndex((row) => row.item.id === selected.item.id));
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = rows[Math.min(rows.length - 1, Math.max(0, index + step))];
        if (next) setSelectedId(next.item.id);
        return;
      }
      if (event.key.toLowerCase() === "w") {
        event.preventDefault();
        event.stopPropagation();
        onSent(selected.item.id);
        window.open(whatsAppChat(selected.item.phone, venue, Math.abs(selected.left)), "_blank", "noopener");
        return;
      }
      if (event.key === "Enter" && !(event.target instanceof HTMLAnchorElement)) {
        event.preventDefault();
        event.stopPropagation();
        onOpen(selected.item.code);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [rows, selected, venue, onClose, onSent, onOpen]);

  useEffect(() => {
    const node = document.querySelector(".timeup-row[data-pick='1']");
    if (node instanceof HTMLElement) node.scrollIntoView({ block: "nearest" });
  }, [selected?.item.id]);

  return (
    <div className="cash-scrim" role="presentation" onClick={onClose}>
      <div className="cash-sheet hold-sheet" role="dialog" aria-modal="true" aria-label="Time's up" onClick={(event) => event.stopPropagation()}>
        <div className="cash-sheet-bar">
          <p>Time&apos;s up · {rows.length}</p>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="cash-hint">WhatsApp opens a chat for the parent. W sends the highlighted family.</p>
        {rows.length === 0 ? (
          <p className="cash-hint">No play time is up.</p>
        ) : (
          <ul className="hold-list">
            {rows.map(({ item, left }) => {
              const over = Math.abs(left);
              const sent = sentIds.includes(item.id);
              return (
                <li
                  key={item.id}
                  className="hold-row timeup-row"
                  data-pick={selected?.item.id === item.id ? "1" : "0"}
                  onMouseEnter={() => setSelectedId(item.id)}
                >
                  <button type="button" onClick={() => onOpen(item.code)}>
                    <span>
                      <strong>{item.guardianName || formatPhone(item.phone)}</strong>
                      <small>
                        {formatPhone(item.phone)} · {item.childCount} {item.childCount === 1 ? "child" : "children"} · {over} min over
                        {sent ? " · Sent" : ""}
                      </small>
                    </span>
                  </button>
                  <a
                    className="timeup-send"
                    data-sent={sent ? "1" : "0"}
                    href={whatsAppChat(item.phone, venue, over)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onSent(item.id)}
                  >
                    {sent ? "Sent" : "WhatsApp"}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
