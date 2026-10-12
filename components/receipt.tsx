import { formatNu } from "@/lib/format";

export function Receipt({
  venue,
  address,
  when,
  code,
  phone,
  lines,
  total,
  cash,
  bank,
  note = "",
  thanks = "Thank you",
  rules = [],
}: {
  venue: string;
  address: string;
  when: string;
  code: string;
  phone: string;
  lines: { name: string; qty: number; amount: number; paid: boolean }[];
  total: number;
  cash: number;
  bank: number;
  note?: string;
  thanks?: string;
  rules?: string[];
}) {
  return (
    <article className="print-receipt">
      <p className="receipt-venue">{venue}</p>
      {address ? <p className="receipt-muted">{address}</p> : null}
      {note ? <p className="receipt-muted">{note}</p> : null}
      <p className="receipt-rule" />
      <p className="receipt-row">
        <span>{when}</span>
        <span>{code}</span>
      </p>
      {phone ? <p className="receipt-muted">{phone}</p> : null}
      <p className="receipt-rule" />
      <ul>
        {lines.map((line, index) => (
          <li key={`${line.name}-${index}`} className="receipt-row">
            <span>
              {line.qty > 1 ? `${line.qty} × ` : ""}
              {line.name}
            </span>
            <span>{formatNu(line.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="receipt-rule" />
      <p className="receipt-row receipt-total">
        <span>Total</span>
        <span>{formatNu(total)}</span>
      </p>
      {cash > 0 ? (
        <p className="receipt-row">
          <span>Cash</span>
          <span>{formatNu(cash)}</span>
        </p>
      ) : null}
      {bank > 0 ? (
        <p className="receipt-row">
          <span>Bank QR</span>
          <span>{formatNu(bank)}</span>
        </p>
      ) : null}
      <p className="receipt-rule" />
      <p className="receipt-thanks">{thanks || "Thank you"}</p>
      {rules.filter(Boolean).map((rule, index) => (
        <p key={`${index}-${rule}`} className="receipt-rule-line">
          {rule}
        </p>
      ))}
    </article>
  );
}
