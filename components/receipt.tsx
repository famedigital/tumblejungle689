import { formatNu } from "@/lib/format";

function isCompLine(name: string) {
  return name.trim().toLowerCase() === "complimentary";
}

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
  number = null,
  complimentary = false,
  waiveNu = null,
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
  number?: number | null;
  complimentary?: boolean;
  waiveNu?: number | null;
}) {
  const items = lines.filter((line) => !isCompLine(line.name));
  const discFromLines = lines.filter((line) => isCompLine(line.name)).reduce((sum, line) => sum + line.amount, 0);
  const subtotal = items.reduce((sum, line) => sum + line.amount, 0);
  const showComp = complimentary || discFromLines < 0;
  const discount =
    discFromLines < 0
      ? discFromLines
      : showComp
        ? -(waiveNu != null && waiveNu > 0 ? waiveNu : subtotal)
        : 0;
  const billTotal = showComp ? Math.max(0, subtotal + discount) : total;
  const bankRows = banks.length > 0 ? banks : bank > 0 ? [{ name: "Bank QR", ref: "", amount: bank }] : [];
  const houseRules = rules.map((rule) => rule.trim()).filter(Boolean);
  const fullComp = showComp && billTotal === 0 && cash <= 0 && bank <= 0;

  return (
    <article className="print-receipt">
      <header className="receipt-head">
        <p className="receipt-kicker">Receipt</p>
        <h1 className="receipt-venue">{venue}</h1>
        {address ? <p className="receipt-address">{address}</p> : null}
        {note ? <p className="receipt-address">{note}</p> : null}
      </header>

      <section className="receipt-meta" aria-label="Bill details">
        {number ? (
          <p className="receipt-row">
            <span>No.</span>
            <span className="receipt-code">#{number}</span>
          </p>
        ) : null}
        {when ? (
          <p className="receipt-row">
            <span>Date</span>
            <span>{when}</span>
          </p>
        ) : null}
        {code ? (
          <p className="receipt-row">
            <span>Ticket</span>
            <span className="receipt-code">{code}</span>
          </p>
        ) : null}
        {phone ? (
          <p className="receipt-row">
            <span>Phone</span>
            <span className="receipt-code">{phone}</span>
          </p>
        ) : null}
      </section>

      <div className="receipt-rule" aria-hidden />

      <p className="receipt-cols">
        <span>Item</span>
        <span>Amt</span>
      </p>
      <ul className="receipt-lines">
        {items.map((line, index) => (
          <li key={`${line.name}-${index}`} className="receipt-line">
            <span className="receipt-item">
              {line.qty > 1 ? <span className="receipt-qty">{line.qty}×</span> : null}
              {line.name}
            </span>
            <span className="receipt-amt">{formatNu(line.amount)}</span>
          </li>
        ))}
      </ul>

      <div className="receipt-rule" aria-hidden />

      <section className="receipt-sum" aria-label="Totals">
        {showComp ? (
          <>
            <p className="receipt-row">
              <span>Subtotal</span>
              <span className="receipt-amt">{formatNu(subtotal)}</span>
            </p>
            <p className="receipt-row">
              <span>Complimentary</span>
              <span className="receipt-amt">{formatNu(discount)}</span>
            </p>
          </>
        ) : null}
        <p className="receipt-row receipt-total">
          <span>Total</span>
          <span className="receipt-amt">{formatNu(billTotal)}</span>
        </p>
        {fullComp ? <p className="receipt-comp">No charge</p> : null}
        {cash > 0 ? (
          <p className="receipt-row receipt-pay">
            <span>Cash</span>
            <span className="receipt-amt">{formatNu(cash)}</span>
          </p>
        ) : null}
        {bankRows.map((row, index) => (
          <div key={`${row.name}-${row.ref}-${index}`} className="receipt-tender">
            <p className="receipt-row receipt-pay">
              <span>{row.name}</span>
              <span className="receipt-amt">{formatNu(row.amount)}</span>
            </p>
            {row.ref ? (
              <p className="receipt-row receipt-jr">
                <span>Ref</span>
                <span className="receipt-code">{row.ref}</span>
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <footer className="receipt-foot">
        <p className="receipt-thanks">{thanks || "Thank you"}</p>
        {houseRules.length ? (
          <ul className="receipt-rules">
            {houseRules.map((rule, index) => (
              <li key={`${index}-${rule}`}>{rule}</li>
            ))}
          </ul>
        ) : null}
        <p className="receipt-end">— end —</p>
      </footer>
    </article>
  );
}
