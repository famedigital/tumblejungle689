function isCompLine(name: string) {
  return name.trim().toLowerCase() === "complimentary";
}

/** Compact Nu for 80mm amount column. */
function thermalNu(amount: number) {
  const n = Math.round(amount);
  const abs = Math.abs(n).toLocaleString("en-IN");
  return n < 0 ? `-Nu ${abs}` : `Nu ${abs}`;
}

const DEFAULT_RULES = [
  "Socks are required on the play floor.",
  "Keep your ticket until you leave.",
  "Food and drink from outside are not allowed.",
  "Ask staff for help with overtime or refunds.",
];

export function Receipt({
  venue,
  address,
  shopPhone = "",
  when,
  code,
  phone,
  lines,
  total,
  cash,
  bank,
  banks = [],
  note = "",
  thanks = "Thank you. Visit again.",
  rules = [],
  number = null,
  complimentary = false,
  waiveNu = null,
  payMethod = "",
  cashReceived = null,
  changeNu = null,
  staffName = "",
  tableNo = "",
  playPaidNote = "",
}: {
  venue: string;
  address: string;
  shopPhone?: string;
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
  /** cash | bank_qr | split | comp */
  payMethod?: string;
  /** Cash notes taken from guest (may be more than total). */
  cashReceived?: number | null;
  /** Auto change = cashReceived - cash portion of bill. */
  changeNu?: number | null;
  staffName?: string;
  tableNo?: string;
  /** Prepaid first play — shown as note, not a charge line. */
  playPaidNote?: string;
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
  const configured = rules.map((rule) => rule.trim()).filter(Boolean);
  const houseRules = configured.length ? configured : DEFAULT_RULES;
  const fullComp = showComp && billTotal === 0 && cash <= 0 && bank <= 0;

  const modeLabel = (() => {
    if (fullComp || payMethod === "comp") return "Complimentary";
    if (payMethod === "split" || (cash > 0 && bank > 0)) return "Split (Cash + Bank)";
    if (cash > 0 && bank <= 0) return "Cash";
    if (bank > 0 && cash <= 0) {
      const names = [...new Set(bankRows.map((row) => row.name.trim()).filter(Boolean))];
      return names.length === 1 ? names[0]! : names.length > 1 ? names.join(" + ") : "Bank QR";
    }
    return payMethod || "—";
  })();

  const received = cashReceived != null && cashReceived > 0 ? Math.round(cashReceived) : null;
  const change =
    changeNu != null && changeNu >= 0
      ? Math.round(changeNu)
      : received != null && cash > 0
        ? Math.max(0, received - cash)
        : null;

  return (
    <article className="print-receipt">
      <header className="receipt-head">
        <p className="receipt-kicker">Official receipt</p>
        <h1 className="receipt-venue">{venue}</h1>
        {address ? <p className="receipt-address">{address}</p> : null}
        {shopPhone ? <p className="receipt-address">Tel {shopPhone}</p> : null}
        {note ? <p className="receipt-address">{note}</p> : null}
      </header>

      <div className="receipt-rule" aria-hidden />

      <section className="receipt-meta" aria-label="Bill details">
        {number ? (
          <p className="receipt-row receipt-total">
            <span>Receipt No.</span>
            <span className="receipt-code">#{number}</span>
          </p>
        ) : code ? (
          <p className="receipt-row receipt-total">
            <span>Receipt No.</span>
            <span className="receipt-code">{code.startsWith("#") ? code : `#${code}`}</span>
          </p>
        ) : null}
        {when ? (
          <p className="receipt-row">
            <span>Tender time</span>
            <span>{when}</span>
          </p>
        ) : null}
        {code && number && String(number) !== code.replace(/^#/, "") ? (
          <p className="receipt-row">
            <span>Ticket</span>
            <span className="receipt-code">{code}</span>
          </p>
        ) : null}
        {tableNo ? (
          <p className="receipt-row">
            <span>Table</span>
            <span className="receipt-code">{tableNo}</span>
          </p>
        ) : null}
        {phone ? (
          <p className="receipt-row">
            <span>Guest phone</span>
            <span className="receipt-code">{phone}</span>
          </p>
        ) : null}
        {staffName ? (
          <p className="receipt-row">
            <span>Cashier</span>
            <span>{staffName}</span>
          </p>
        ) : null}
      </section>

      <div className="receipt-rule" aria-hidden />

      {playPaidNote ? <p className="receipt-address">{playPaidNote}</p> : null}

      <p className="receipt-cols">
        <span>Item</span>
        <span>Amt</span>
      </p>
      <ul className="receipt-lines">
        {items.map((line, index) => (
          <li key={`${line.name}-${index}`} className="receipt-line">
            <span className="receipt-item">
              <span className="receipt-qty">{line.qty}×</span>
              {line.name}
            </span>
            <span className="receipt-amt">{thermalNu(line.amount)}</span>
          </li>
        ))}
      </ul>

      <div className="receipt-rule" aria-hidden />

      <section className="receipt-sum" aria-label="Totals">
        {showComp ? (
          <>
            <p className="receipt-row">
              <span>Subtotal</span>
              <span className="receipt-amt">{thermalNu(subtotal)}</span>
            </p>
            <p className="receipt-row">
              <span>Complimentary</span>
              <span className="receipt-amt">{thermalNu(discount)}</span>
            </p>
          </>
        ) : null}
        <p className="receipt-row receipt-total">
          <span>Total</span>
          <span className="receipt-amt">{thermalNu(billTotal)}</span>
        </p>
        {fullComp ? <p className="receipt-comp">No charge</p> : null}
      </section>

      <div className="receipt-rule" aria-hidden />

      <section className="receipt-pay-block" aria-label="Payment">
        <p className="receipt-pay-title">Payment</p>
        <p className="receipt-row receipt-pay">
          <span>Mode</span>
          <span className="receipt-code">{modeLabel}</span>
        </p>

        {cash > 0 ? (
          <p className="receipt-row receipt-pay">
            <span>Cash (bill)</span>
            <span className="receipt-amt">{thermalNu(cash)}</span>
          </p>
        ) : null}

        {received != null ? (
          <p className="receipt-row receipt-pay">
            <span>Cash received</span>
            <span className="receipt-amt">{thermalNu(received)}</span>
          </p>
        ) : null}

        {change != null && received != null ? (
          <p className="receipt-row receipt-pay receipt-change">
            <span>Change</span>
            <span className="receipt-amt">{thermalNu(change)}</span>
          </p>
        ) : null}

        {bankRows.map((row, index) => (
          <div key={`${row.name}-${row.ref}-${index}`} className="receipt-tender">
            <p className="receipt-row receipt-pay">
              <span>Bank / App</span>
              <span className="receipt-code">{row.name || "Bank QR"}</span>
            </p>
            <p className="receipt-row receipt-pay">
              <span>Amount</span>
              <span className="receipt-amt">{thermalNu(row.amount)}</span>
            </p>
            {row.ref ? (
              <p className="receipt-row receipt-jr">
                <span>Jr No.</span>
                <span className="receipt-code">{row.ref}</span>
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <div className="receipt-rule" aria-hidden />

      <footer className="receipt-foot">
        <p className="receipt-thanks">{thanks || "Thank you. Visit again."}</p>
        <p className="receipt-rules-title">House rules</p>
        <ul className="receipt-rules">
          {houseRules.map((rule, index) => (
            <li key={`${index}-${rule}`}>{rule}</li>
          ))}
        </ul>
        <p className="receipt-end">*** end of receipt ***</p>
      </footer>
    </article>
  );
}
