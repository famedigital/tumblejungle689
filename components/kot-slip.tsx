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
  lines,
}: {
  venue: string;
  tableNo: string;
  phone: string;
  code: string;
  qr: string;
  when: string;
  reprint: boolean;
  lines: { name: string; qty: number; outlet: Outlet; note: string }[];
}) {
  const groups = (["restaurant", "cafe"] as const)
    .map((outlet) => ({ outlet, lines: lines.filter((line) => line.outlet === outlet) }))
    .filter((group) => group.lines.length > 0);

  return (
    <article className="print-kot">
      <p className="kot-kicker">{reprint ? "Reprint" : "Kitchen order"}</p>
      <p className="kot-venue">{venue}</p>
      <p className="kot-table">Table {tableNo}</p>
      <p className="kot-who">{formatPhone(phone)}</p>
      <p className="kot-who">Ticket {code}</p>
      {qr ? <img src={qr} alt="" /> : null}
      <p className="kot-when">{when}</p>
      {groups.map((group) => (
        <section key={group.outlet}>
          <p className="kot-place">{group.outlet === "cafe" ? "Cafe" : "Restaurant"}</p>
          <ul>
            {group.lines.map((line, index) => (
              <li key={`${line.name}-${index}`}>
                <span>
                  {line.qty} × {line.name}
                </span>
                {line.note ? <small>{line.note}</small> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
