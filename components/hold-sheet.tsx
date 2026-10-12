"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cancelHoldAction } from "@/app/actions";
import { MiniRing, playSpanMinutes } from "@/components/live-timer";
import { formatNu, formatPhone, minutesLeft } from "@/lib/format";
import type { VisitView } from "@/lib/types";

type Filter = "all" | "ending" | "over";

export function HoldSheet({
  visits,
  now,
  currentId,
  onClose,
}: {
  visits: VisitView[];
  now: number;
  currentId?: number;
  onClose: () => void;
}) {
  const [find, setFind] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const needle = find.trim().toLowerCase().replace(/\s/g, "");

  const rows = useMemo(() => {
    return visits
      .map((visit) => ({ visit, left: minutesLeft(visit.paidUntil, now) }))
      .filter(({ visit, left }) => {
        if (filter === "over" && left >= 0) return false;
        if (filter === "ending" && (left < 0 || left > 5)) return false;
        if (!needle) return true;
        const hay = `${visit.phone} ${visit.code} ${visit.guardianName}`.toLowerCase().replace(/\s/g, "");
        return hay.includes(needle);
      })
      .sort((a, b) => a.left - b.left);
  }, [visits, now, filter, needle]);

  const overdue = visits.filter((visit) => minutesLeft(visit.paidUntil, now) < 0).length;
  const ending = visits.filter((visit) => {
    const left = minutesLeft(visit.paidUntil, now);
    return left >= 0 && left <= 5;
  }).length;
  const selected = rows.find((row) => row.visit.id === selectedId) ?? rows[0] ?? null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (!rows.length) return;
      const index = Math.max(0, rows.findIndex((row) => row.visit.id === selected?.visit.id));
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedId(rows[Math.min(rows.length - 1, index + 1)].visit.id);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedId(rows[Math.max(0, index - 1)].visit.id);
      } else if (event.key === "Delete" && selected) {
        event.preventDefault();
        const form = document.querySelector(`form[data-hold-id="${selected.visit.id}"]`);
        if (form instanceof HTMLFormElement) form.requestSubmit();
      } else if (event.key === "Enter" && selected && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        window.location.href = `/cashier?q=${selected.visit.code}`;
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [rows, selected, onClose]);

  useEffect(() => {
    const node = document.querySelector(".hold-row[data-pick='1']");
    if (node instanceof HTMLElement) node.scrollIntoView({ block: "nearest" });
  }, [selected?.visit.id]);

  return (
    <div className="cash-scrim" role="presentation" onClick={onClose}>
      <div className="cash-sheet hold-sheet" role="dialog" aria-modal="true" aria-label="People on hold" onClick={(event) => event.stopPropagation()}>
        <div className="cash-sheet-bar">
          <p>On hold · {visits.length}</p>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="cash-hint">Alt+H opens this list. The shortest time is at the top.</p>
        <input
          autoFocus
          value={find}
          onChange={(event) => setFind(event.target.value)}
          placeholder="Phone, name, or ticket"
          aria-label="Find a customer"
          className="cash-find"
        />
        <div className="cash-places" role="tablist" aria-label="Who to show">
          <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
            All {visits.length}
          </button>
          <button type="button" role="tab" aria-selected={filter === "ending"} onClick={() => setFilter("ending")}>
            Ending {ending}
          </button>
          <button type="button" role="tab" aria-selected={filter === "over"} onClick={() => setFilter("over")}>
            Overtime {overdue}
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="cash-hint">{visits.length === 0 ? "No one is on hold." : "No one matches."}</p>
        ) : (
          <ul className="hold-list">
            {rows.map(({ visit }) => (
              <li
                key={visit.id}
                className="hold-row"
                data-hold=""
                data-pick={selected?.visit.id === visit.id ? "1" : "0"}
                onMouseEnter={() => setSelectedId(visit.id)}
              >
                <Link href={`/cashier?q=${visit.code}`} aria-current={visit.id === currentId ? "page" : undefined}>
                  <MiniRing end={visit.paidUntil} spanMin={playSpanMinutes(visit.blocks)} />
                  <span>
                    <strong>{formatPhone(visit.phone)}</strong>
                    <small>
                      {visit.guardianName ? `${visit.guardianName} · ` : ""}
                      {visit.childCount} {visit.childCount === 1 ? "child" : "children"} · {visit.code}
                    </small>
                  </span>
                </Link>
                {visit.dueNu > 0 ? <b>{formatNu(visit.dueNu)}</b> : <b className="hold-clear">Paid</b>}
                <form action={cancelHoldAction} data-hold-id={visit.id}>
                  <input type="hidden" name="visitId" value={visit.id} />
                  <input type="hidden" name="code" value={visit.code} />
                  <input type="hidden" name="back" value="/cashier" />
                  <button type="submit" className="hold-remove">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
