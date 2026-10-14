import { formatPhone, formatWhen } from "@/lib/format";

export function PlayPass({
  venue,
  code,
  phone,
  qr,
  children,
  started,
  ends,
}: {
  venue: string;
  code: string;
  phone: string;
  qr: string;
  children: number;
  started: string;
  ends: string;
}) {
  const kids = Math.max(0, children);
  return (
    <div className="print-sticker-sheet">
      <article className="print-sticker">
        <p className="pass-kicker">Play pass</p>
        <p className="pass-venue">{venue}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${code}`} />
        <p className="sticker-code">{code}</p>
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
