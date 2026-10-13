import { formatPhone } from "@/lib/format";
import type { Outlet } from "@/lib/types";

export function KotSlip({
  venue,
  tableNo,
  phone,
  code,
  qr,
  when,
  reprint,
  ticket = "kot",
  cancel = false,
  lines,
}: {
  venue: string;
  tableNo: string;
  phone: string;
  code: string;
  qr: string;
  when: string;
  reprint: boolean;
  ticket?: "bot" | "kot";
  cancel?: boolean;
  lines: { name: string; qty: number; outlet: Outlet; note: string }[];
}) {
  const title = cancel ? "Cancel" : reprint ? "Reprint" : ticket === "bot" ? "Bar order" : "Kitchen order";

  return (
    <article className="print-kot">
      <p className="kot-kicker">{title}</p>
      <p className="kot-venue">{venue}</p>
      <p className="kot-table">Table {tableNo}</p>
      <p className="kot-who">{formatPhone(phone)}</p>
      <p className="kot-who">Ticket {code}</p>
      {qr ? <img src={qr} alt="" /> : null}
      <p className="kot-when">{when}</p>
      <ul>
        {lines.map((line, index) => (
          <li key={`${line.name}-${index}`}>
            <span>
              {line.qty} × {line.name}
            </span>
            {line.note ? <small>{line.note}</small> : null}
          </li>
        ))}
      </ul>
    </article>
  );
}
