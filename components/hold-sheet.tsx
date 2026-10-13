"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cancelHoldAction, leaveHoldAction, releaseHoldAction } from "@/app/actions";
import { KotSlip } from "@/components/kot-slip";
import { MiniRing, playSpanMinutes } from "@/components/live-timer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatNu, formatPhone, minutesLeft, tableLabel } from "@/lib/format";
import type { VisitView } from "@/lib/types";
import { canFloorDrop, canLeaveOnTime, isPlayVisit, playIsOvertime } from "@/lib/visit-rules";

type Filter = "all" | "ending" | "over";

export function HoldSheet({
  visits,
  now,
  currentId,
  onClose,
  desk = "/cashier",
  venue = "Tumble Jumble",
  staff = "",
  onOpen,
  onLeave,
  onCancel,
  onRelease,
}: {
  visits: VisitView[];
  now: number;
  currentId?: number;
  onClose: () => void;
  desk?: string;
  venue?: string;
  staff?: string;
  onOpen?: (visit: VisitView) => void;
  onLeave?: (visit: VisitView) => void;
  onCancel?: (visit: VisitView) => void;
  onRelease?: (visit: VisitView, choice: "waive" | "delete", secret: string) => void;
}) {
  const [find, setFind] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [gate, setGate] = useState<{ id: number; mode: "over" | "void" } | null>(null);
  const needle = find.trim().toLowerCase().replace(/\s/g, "");

  const rows = useMemo(() => {
    return visits
      .map((visit) => ({ visit, left: minutesLeft(visit.paidUntil, now) }))
      .filter(({ visit, left }) => {
        const playing = isPlayVisit(visit);
        if (filter === "over" && (!playing || left >= 0)) return false;
        if (filter === "ending" && (!playing || left < 0 || left > 5)) return false;
        if (!needle) return true;
        const hay = `${visit.phone} ${visit.code} ${visit.guardianName}`.toLowerCase().replace(/\s/g, "");
        return hay.includes(needle);
      })
      .sort((a, b) => {
        const ap = isPlayVisit(a.visit) ? a.left : Number.POSITIVE_INFINITY;
        const bp = isPlayVisit(b.visit) ? b.left : Number.POSITIVE_INFINITY;
        return ap - bp;
      });
  }, [visits, now, filter, needle]);

  const overdue = visits.filter((visit) => isPlayVisit(visit) && minutesLeft(visit.paidUntil, now) < 0).length;
  const ending = visits.filter((visit) => {
    const left = minutesLeft(visit.paidUntil, now);
    return isPlayVisit(visit) && left >= 0 && left <= 5;
  }).length;
  const selected = rows.find((row) => row.visit.id === selectedId) ?? rows[0] ?? null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (gate && event.key !== "Escape") return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (gate) {
          setGate(null);
          return;
        }
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
        const over = playIsOvertime(selected.visit, now);
        if (over) {
          setGate({ id: selected.visit.id, mode: "over" });
          return;
        }
        if (!canLeaveOnTime(selected.visit, now) && !canFloorDrop(selected.visit, now)) {
          setGate({ id: selected.visit.id, mode: "void" });
          return;
        }
        if (canLeaveOnTime(selected.visit, now) && onLeave) {
          onLeave(selected.visit);
          return;
        }
        if (canFloorDrop(selected.visit, now) && onCancel) {
          onCancel(selected.visit);
          return;
        }
        const form = document.querySelector(`form[data-hold-id="${selected.visit.id}"]`);
        if (form instanceof HTMLFormElement) form.requestSubmit();
      } else if (event.key === "Enter" && selected && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        if (onOpen) onOpen(selected.visit);
        else window.location.href = `${desk}?q=${selected.visit.code}`;
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [rows, selected, onClose, desk, gate, now, onOpen, onLeave, onCancel]);

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
            {rows.map(({ visit, left }) => {
              const playing = isPlayVisit(visit);
              const over = playing && left < 0;
              return (
              <li
                key={visit.id}
                className="hold-row"
                data-hold=""
                data-pick={selected?.visit.id === visit.id ? "1" : "0"}
                onMouseEnter={() => setSelectedId(visit.id)}
              >
                {onOpen ? (
                  <button type="button" onClick={() => onOpen(visit)}>
                    {playing ? <MiniRing end={visit.paidUntil} spanMin={playSpanMinutes(visit.blocks)} /> : <span className="text-xs text-muted-foreground">Bill</span>}
                    <span>
                      <strong>{playing ? formatPhone(visit.phone) : tableLabel(visit.tableNo)}</strong>
                      <small>
                        {playing
                          ? `${visit.childCount} ${visit.childCount === 1 ? "child" : "children"} · ${visit.code}`
                          : `${visit.lines.reduce((sum, line) => sum + line.qty, 0)} items · ${visit.code}`}
                      </small>
                    </span>
                  </button>
                ) : (
                <Link href={`${desk}?q=${visit.code}`} aria-current={visit.id === currentId ? "page" : undefined}>
                  {playing ? <MiniRing end={visit.paidUntil} spanMin={playSpanMinutes(visit.blocks)} /> : <span className="text-xs text-muted-foreground">Bill</span>}
                  <span>
                    <strong>{playing ? formatPhone(visit.phone) : tableLabel(visit.tableNo)}</strong>
                    <small>
                      {playing
                        ? `${visit.childCount} ${visit.childCount === 1 ? "child" : "children"} · ${visit.code}`
                        : `${visit.lines.reduce((sum, line) => sum + line.qty, 0)} items · ${visit.code}`}
                    </small>
                  </span>
                </Link>
                )}
                {visit.dueNu > 0 ? <b>{formatNu(visit.dueNu)}</b> : <b className="hold-clear">Paid</b>}
                {over ? (
                  <Button type="button" size="xs" variant="outline" onClick={() => setGate({ id: visit.id, mode: "over" })}>
                    Delete
                  </Button>
                ) : canLeaveOnTime(visit, now) ? (
                  onLeave ? (
                    <Button type="button" size="xs" variant="outline" onClick={() => onLeave(visit)}>
                      Left
                    </Button>
                  ) : (
                  <form action={leaveHoldAction} data-hold-id={visit.id}>
                    <input type="hidden" name="visitId" value={visit.id} />
                    <input type="hidden" name="code" value={visit.code} />
                    <input type="hidden" name="back" value={desk} />
                    <Button type="submit" size="xs" variant="outline">
                      Left
                    </Button>
                  </form>
                  )
                ) : canFloorDrop(visit, now) ? (
                  onCancel ? (
                    <Button type="button" size="xs" variant="outline" onClick={() => onCancel(visit)}>
                      Remove
                    </Button>
                  ) : (
                  <form action={cancelHoldAction} data-hold-id={visit.id}>
                    <input type="hidden" name="visitId" value={visit.id} />
                    <input type="hidden" name="code" value={visit.code} />
                    <input type="hidden" name="back" value={desk} />
                    <Button type="submit" size="xs" variant="outline">
                      Remove
                    </Button>
                  </form>
                  )
                ) : (
                  <Button type="button" size="xs" variant="outline" onClick={() => setGate({ id: visit.id, mode: "void" })}>
                    Void
                  </Button>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </div>
      <OvertimeGate
        visit={visits.find((visit) => visit.id === gate?.id) ?? null}
        mode={gate?.mode ?? "over"}
        desk={desk}
        venue={venue}
        staff={staff}
        onClose={() => setGate(null)}
        onOpen={onOpen}
        onRelease={onRelease}
      />
    </div>
  );
}

function OvertimeGate({
  visit,
  mode,
  desk,
  venue,
  staff,
  onClose,
  onOpen,
  onRelease,
}: {
  visit: VisitView | null;
  mode: "over" | "void";
  desk: string;
  venue: string;
  staff: string;
  onClose: () => void;
  onOpen?: (visit: VisitView) => void;
  onRelease?: (visit: VisitView, choice: "waive" | "delete", secret: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [armed, setArmed] = useState(false);
  const [stamp, setStamp] = useState("");
  const fired = visit?.lines.filter((line) => !line.paid && line.firedQty > 0) ?? [];

  useEffect(() => {
    if (!armed) return;
    document.body.dataset.print = "kot";
    const done = () => {
      delete document.body.dataset.print;
      window.removeEventListener("afterprint", done);
      const button = formRef.current?.querySelector('button[value="delete"]');
      if (button instanceof HTMLButtonElement) formRef.current?.requestSubmit(button);
    };
    window.addEventListener("afterprint", done);
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [armed]);

  return (
    <Dialog open={visit != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "over" ? "Play is overtime" : "Manager void"}</DialogTitle>
          <DialogDescription>
            {mode === "over"
              ? "Take payment for the extra time, or a manager can make the overtime free or void the visit."
              : "Take payment, or a manager can void this bill. Food already sent prints a cancel first."}
          </DialogDescription>
        </DialogHeader>
        {visit ? (
          <div className="grid gap-3">
            {onOpen && visit ? (
              <Button type="button" onClick={() => onOpen(visit)}>
                Take payment
              </Button>
            ) : (
            <Button asChild>
              <Link href={`${desk}?q=${visit.code}`} onClick={onClose}>
                Take payment
              </Link>
            </Button>
            )}
            <form
              ref={formRef}
              action={onRelease ? undefined : releaseHoldAction}
              className="grid gap-3"
              onSubmit={(event) => {
                const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
                const choice = submitter instanceof HTMLButtonElement ? submitter.value : "";
                const pin = String(new FormData(event.currentTarget).get("secret") ?? "").trim();
                if (choice === "delete" && fired.length > 0 && !armed && pin) {
                  event.preventDefault();
                  setStamp(new Date().toISOString());
                  setArmed(true);
                  return;
                }
                if (onRelease && visit && pin && (choice === "waive" || choice === "delete")) {
                  event.preventDefault();
                  onRelease(visit, choice === "waive" ? "waive" : "delete", pin);
                  onClose();
                }
              }}
            >
              <input type="hidden" name="visitId" value={visit.id} />
              <input type="hidden" name="code" value={visit.code} />
              <input type="hidden" name="back" value={desk} />
              <Field label="Manager PIN">
                <Input name="secret" type="text" inputMode="numeric" autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus className="till-secret" />
              </Field>
              <div className="flex gap-2">
                {mode === "over" ? (
                  <Button type="submit" name="choice" value="waive" variant="outline" className="flex-1">
                    Free of charge
                  </Button>
                ) : null}
                <Button type="submit" name="choice" value="delete" variant="destructive" className="flex-1">
                  Void
                </Button>
              </div>
            </form>
            {armed && fired.length > 0 ? (
              <KotSlip
                venue={venue}
                tableNo={visit.tableNo || "Counter"}
                phone={visit.phone}
                code={visit.code}
                orderedAt={stamp || new Date().toISOString()}
                staff={staff}
                reprint={false}
                cancel
                lines={fired.map((line) => ({
                  name: line.name,
                  qty: line.firedQty,
                  outlet: line.outlet,
                  note: "Cancel",
                }))}
              />
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
