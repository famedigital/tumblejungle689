import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { formatNu, formatPhone, formatWhen, minutesLeft } from "@/lib/format";
import type { VisitView } from "@/lib/types";

export function PassCard({
  visit,
  venueName,
  qr,
  ticketUrl,
}: {
  visit: VisitView;
  venueName: string;
  qr: string;
  ticketUrl: string;
}) {
  const left = minutesLeft(visit.paidUntil);
  const timeLabel =
    visit.status === "settled"
      ? "Closed"
      : left >= 0
        ? `${left} min left`
        : `${Math.abs(left)} min overtime`;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap gap-2">
        <PrintButton mode="ticket">Print ticket</PrintButton>
        <PrintButton mode="sticker">Print sticker</PrintButton>
        <a className="inline-flex h-11 items-center rounded-lg border px-4 text-sm font-medium" href={ticketUrl}>
          Open on a phone
        </a>
      </div>

      <article className="print-ticket print-sheet mx-auto max-w-sm rounded-2xl border border-dashed border-primary/40 bg-white p-5 text-foreground">
        <p className="text-xs uppercase tracking-[0.18em] text-primary">{venueName}</p>
        <h2 className="font-heading text-3xl">Play ticket</h2>
        <p className="mt-1 font-mono text-2xl tracking-[0.2em]">{visit.code}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="font-medium">{formatPhone(visit.phone)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Children</dt>
            <dd className="font-medium">{visit.childCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Paid until</dt>
            <dd className="font-medium">{formatWhen(visit.paidUntil)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time</dt>
            <dd className="font-medium">{timeLabel}</dd>
          </div>
        </dl>
        {visit.guardianName ? <p className="mt-3 text-sm">{visit.guardianName}</p> : null}
        <img src={qr} alt="" className="mx-auto mt-4 size-48" />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Scan at the cafe, restaurant, or cashier. If this ticket is lost, give the phone number.
        </p>
        <ul className="mt-4 space-y-1 border-t pt-3 text-sm">
          {visit.blocks.map((block) => (
            <li key={block.id} className="flex justify-between gap-3">
              <span>
                Play {block.minutes} min {block.paid ? "" : "(due)"}
              </span>
              <span>{formatNu(block.amountNu)}</span>
            </li>
          ))}
          {visit.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3">
              <span>
                {line.qty} × {line.name} {line.paid ? "" : "(due)"}
              </span>
              <span>{formatNu(line.amountNu)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t pt-3 font-medium">
          <span>Still due</span>
          <span>{formatNu(visit.dueNu)}</span>
        </p>
      </article>

      <article className="print-sticker print-sheet mx-auto hidden w-[52mm] rounded-md border bg-white p-2 text-center print:block">
        <p className="text-[10px] font-medium uppercase tracking-wider">{venueName}</p>
        <img src={qr} alt="" className="mx-auto size-24" />
        <p className="font-mono text-sm tracking-widest">{visit.code}</p>
        <p className="text-[10px]">{formatPhone(visit.phone)}</p>
      </article>

      <div className="pass-screen no-print">
        <Badge variant={visit.status === "open" ? "default" : "secondary"}>{visit.status === "open" ? timeLabel : "Closed"}</Badge>
      </div>
    </div>
  );
}
