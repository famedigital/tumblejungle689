import { formatOrderStamp, formatPhone, tableLabel } from "@/lib/format";
import type { Outlet } from "@/lib/types";

function placeLabel(tableNo: string) {
  const raw = tableNo.trim();
  if (!raw || raw.toLowerCase() === "counter") return "Counter";
  return tableLabel(raw);
}

export function KotSlip({
  venue,
  tableNo,
  phone,
  code,
  orderedAt,
  staff = "",
  reprint,
  ticket = "kot",
  cancel = false,
  lines,
}: {
  venue: string;
  tableNo: string;
  phone: string;
  code: string;
  orderedAt: string;
  staff?: string;
  reprint: boolean;
  ticket?: "bot" | "kot";
  cancel?: boolean;
  lines: { name: string; qty: number; outlet: Outlet; note: string }[];
}) {
  const stamp = formatOrderStamp(orderedAt);
  const kind = ticket === "bot" ? "Bar order" : "Kitchen order";
  const banner = cancel ? "Cancel" : reprint ? "Reprint" : kind;
  const guest = formatPhone(phone);
  const count = lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <article className={`print-kot${cancel ? " kot-cancel" : ""}`}>
      <p className="kot-kicker">{banner}</p>
      {cancel || reprint ? <p className="kot-kind">{kind}</p> : null}
      <p className="kot-venue">{venue}</p>
      <p className="kot-table">{placeLabel(tableNo)}</p>
      <p className="kot-clock">{stamp.clock}</p>
      <p className="kot-when">Ordered {stamp.date}</p>
      <dl className="kot-meta">
        <div>
          <dt>Ticket</dt>
          <dd>{code}</dd>
        </div>
        {guest ? (
          <div>
            <dt>Phone</dt>
            <dd>{guest}</dd>
          </div>
        ) : null}
        {staff ? (
          <div>
            <dt>By</dt>
            <dd>{staff}</dd>
          </div>
        ) : null}
      </dl>
      <ul>
        {lines.map((line, index) => (
          <li key={`${line.name}-${index}`}>
            <b>{line.qty}</b>
            <span>
              {line.name}
              {line.note ? <small>{line.note}</small> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="kot-count">
        {count} {count === 1 ? "item" : "items"}
      </p>
      <p className="kot-end">End of order</p>
    </article>
  );
}
