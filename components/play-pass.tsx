import { formatPhone, formatWhen } from "@/lib/format";

export function PlayPass({
  venue,
  code,
  receiptNo = null,
  phone,
  qr,
  childCount,
  children: legacyChildren,
  started,
  ends,
}: {
  venue: string;
  code: string;
  receiptNo?: number | null;
  phone: string;
  qr: string;
  childCount?: number;
  children?: number;
  started: string;
  ends: string;
}) {
  const count = childCount ?? legacyChildren ?? 1;
  const kids = Math.max(0, count);
  const display = receiptNo && receiptNo > 0 ? `#${receiptNo}` : code;
  return (
    <div className="print-sticker-sheet">
      <article className="print-sticker">
        <p className="pass-kicker">Play pass · Receipt No.</p>
        <p className="pass-venue">{venue}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${display}`} />
        <p className="sticker-code">{display}</p>
        <p className="pass-type-hint">Type this Receipt No. at the till (Find / Ctrl+K). Scanner not required.</p>
        <dl className="pass-facts">
          <div>
            <dt>Start</dt>
            <dd>{formatWhen(started)}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{formatWhen(ends)}</dd>
          </div>
          <div>
            <dt>Mobile</dt>
            <dd>{formatPhone(phone)}</dd>
          </div>
          <div>
            <dt>Children</dt>
            <dd>{kids === 1 ? "1 child" : `${kids} children`}</dd>
          </div>
        </dl>
      </article>
    </div>
  );
}
