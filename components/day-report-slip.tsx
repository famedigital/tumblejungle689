import { formatNu } from "@/lib/format";
import type { DayReportPack } from "@/lib/day-report";

function methodLabel(method: string) {
  if (method === "cash") return "Cash";
  if (method === "bank_qr") return "Bank";
  return method || "—";
}

function kindLabel(kind: string) {
  if (kind === "playtime") return "Play";
  if (kind === "extension") return "Ext";
  if (kind === "food") return "F&B";
  return kind || "—";
}

export function DayReportSlip({ pack }: { pack: DayReportPack }) {
  const busyHours = pack.hours.filter((row) => row.play > 0 || row.food > 0);
  const stations = pack.stations.filter((row) => row.amount > 0);

  return (
    <article className="print-day-report" aria-label="Day report">
      <header className="day-head">
        <p className="day-kicker">Owner day report</p>
        <h1 className="day-venue">{pack.venue}</h1>
        <p className="day-date">{pack.dateKey}</p>
        <p className="day-date" style={{ fontSize: "10px", fontWeight: 700 }}>
          Printed {pack.generatedAt}
        </p>
      </header>

      <div className="day-rule" aria-hidden />

      <p className="day-section">Takings</p>
      <ul>
        <li className="day-row">
          <span>Cash</span>
          <b>{formatNu(pack.takings.cashNu)}</b>
        </li>
        <li className="day-row">
          <span>Bank QR</span>
          <b>{formatNu(pack.takings.bankNu)}</b>
        </li>
        <li className="day-row">
          <span>Play</span>
          <b>{formatNu(pack.takings.playNu)}</b>
        </li>
        <li className="day-row">
          <span>F&amp;B</span>
          <b>{formatNu(pack.takings.foodNu)}</b>
        </li>
        <li className="day-row">
          <span>KOT (restaurant)</span>
          <b>{formatNu(pack.takings.kotNu)}</b>
        </li>
        <li className="day-row">
          <span>Cafe</span>
          <b>{formatNu(pack.takings.botNu)}</b>
        </li>
        <li className="day-row day-total">
          <span>Total</span>
          <b>{formatNu(pack.takings.totalNu)}</b>
        </li>
      </ul>

      <div className="day-rule" aria-hidden />

      <p className="day-section">Counts</p>
      <ul>
        <li className="day-row">
          <span>Settled tickets</span>
          <b>{pack.counts.settledTickets}</b>
        </li>
        <li className="day-row">
          <span>Open visits</span>
          <b>{pack.counts.openVisits}</b>
        </li>
        <li className="day-row">
          <span>Payments</span>
          <b>{pack.counts.paymentCount}</b>
        </li>
        {pack.voidsNu > 0 ? (
          <li className="day-row">
            <span>Voids</span>
            <b>{formatNu(pack.voidsNu)}</b>
          </li>
        ) : null}
        {pack.compsNu > 0 ? (
          <li className="day-row">
            <span>Comps</span>
            <b>{formatNu(pack.compsNu)}</b>
          </li>
        ) : null}
      </ul>

      {stations.length ? (
        <>
          <div className="day-rule" aria-hidden />
          <p className="day-section">Stations</p>
          <ul>
            {stations.map((row) => (
              <li key={row.station} className="day-row">
                <span>{row.station}</span>
                <b>{formatNu(row.amount)}</b>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {busyHours.length ? (
        <>
          <div className="day-rule" aria-hidden />
          <p className="day-section">Hourly play / food</p>
          <ul>
            {busyHours.map((row) => (
              <li key={row.hour} className="day-line">
                <span>{row.hour}</span>
                <span>
                  P {formatNu(row.play)} · F {formatNu(row.food)}
                </span>
                <span>{formatNu(row.play + row.food)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {pack.openVisits.length ? (
        <>
          <div className="day-rule" aria-hidden />
          <p className="day-section">Open due</p>
          <ul>
            {pack.openVisits.map((visit) => (
              <li key={visit.code} className="day-line">
                <span className="receipt-code">{visit.code}</span>
                <span>{visit.phone || "—"}</span>
                <span>{formatNu(visit.dueNu)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {pack.payments.length ? (
        <>
          <div className="day-rule" aria-hidden />
          <p className="day-section">Payments</p>
          <ul>
            {pack.payments.map((pay, index) => (
              <li key={`${pay.time}-${index}`} className="day-line">
                <span>{pay.time}</span>
                <span>
                  {methodLabel(pay.method)} {kindLabel(pay.kind)}
                </span>
                <span>{formatNu(pay.amountNu)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="day-end">*** end of day report ***</p>
    </article>
  );
}
