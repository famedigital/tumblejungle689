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
  banks = [],
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
  banks?: { name: string; ref: string; amount: number }[];
  note?: string;
  thanks?: string;
  rules?: string[];
}) {
  const bankRows = banks.length > 0 ? banks : bank > 0 ? [{ name: "Bank QR", ref: "", amount: bank }] : [];
  const paid = [
    cash > 0 ? { label: "Cash", amount: cash, ref: "" } : null,
    ...bankRows.map((row) => ({ label: row.name, amount: row.amount, ref: row.ref })),
  ].filter((row) => row !== null);

  return (
    <article className="print-receipt">
      <header className="receipt-head">
        <p className="receipt-kicker">Bill</p>
        <h1 className="receipt-venue">{venue}</h1>
        {address ? <p className="receipt-address">{address}</p> : null}
        {note ? <p className="receipt-address">{note}</p> : null}
      </header>
      <section className="receipt-meta">
        <p className="receipt-row">
          <span>When</span>
          <span>{when}</span>
        </p>
        {code ? (
          <p className="receipt-row">
            <span>Ticket</span>
            <span className="receipt-code">{code}</span>
          </p>
        ) : null}
        {phone ? (
          <p className="receipt-row">
            <span>Phone</span>
            <span>{phone}</span>
          </p>
        ) : null}
      </section>
      <p className="receipt-cols">
        <span>Item</span>
        <span>Amount</span>
      </p>
      <ul>
        {lines.map((line, index) => (
          <li key={`${line.name}-${index}`} className="receipt-row">
            <span>
              {line.qty > 1 ? `${line.qty} × ` : ""}
              {line.name}
            </span>
            <span className="receipt-amt">{formatNu(line.amount)}</span>
          </li>
        ))}
      </ul>
      <section className="receipt-sum">
        <p className="receipt-row receipt-total">
          <span>Total</span>
          <span className="receipt-amt">{formatNu(total)}</span>
        </p>
        {paid.map((row, index) => (
          <div key={`${row.label}-${row.ref}-${index}`}>
            <p className="receipt-row receipt-pay">
              <span>{row.label}</span>
              <span className="receipt-amt">{formatNu(row.amount)}</span>
            </p>
            {row.ref ? (
              <p className="receipt-row receipt-jr">
                <span>Jr no</span>
                <span className="receipt-code">{row.ref}</span>
              </p>
            ) : null}
          </div>
        ))}
      </section>
      <footer className="receipt-foot">
        <p className="receipt-thanks">{thanks || "Thank you"}</p>
        {rules.filter(Boolean).map((rule, index) => (
          <p key={`${index}-${rule}`} className="receipt-rule-line">
            {rule}
          </p>
        ))}
      </footer>
    </article>
  );
}
