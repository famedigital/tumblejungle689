import {
  addItemAction,
  addPlayAction,
  payOutletAction,
  payPlayAction,
  qtyAction,
  removePlayAction,
  settleAction,
} from "@/app/actions";
import { PayQr } from "@/components/pay-qr";
import { Button } from "@/components/ui/button";
import { formatNu, formatPhone, formatWhen, minutesLeft } from "@/lib/format";
import { overtimeSentence } from "@/lib/overtime";
import type { MenuItem, Outlet, Rate, VisitView } from "@/lib/types";

function outletDue(visit: VisitView, outlet: Outlet): number {
  return visit.lines
    .filter((line) => line.outlet === outlet && !line.paid)
    .reduce((sum, line) => sum + line.amountNu, 0);
}

function playDue(visit: VisitView): number {
  return visit.blocks.filter((block) => !block.paid).reduce((sum, block) => sum + block.amountNu, 0);
}

const TILES = [
  "border-transparent bg-[#fff1c9] hover:bg-[#ffe08a]",
  "border-transparent bg-[#d9f6ef] hover:bg-[#b7ebe3]",
  "border-transparent bg-[#d9f3ff] hover:bg-[#b9e8ff]",
  "border-transparent bg-[#ffe1dc] hover:bg-[#ffc9c0]",
  "border-transparent bg-[#f3e4ff] hover:bg-[#e4d0ff]",
];

export function VisitBoard({
  visit,
  rates,
  staticPayload,
  back,
  outlet,
  menu = [],
  allowSettle = false,
  allowExtend = false,
}: {
  visit: VisitView;
  rates: Rate[];
  staticPayload: string;
  back: string;
  outlet?: Outlet;
  menu?: MenuItem[];
  allowSettle?: boolean;
  allowExtend?: boolean;
}) {
  const left = minutesLeft(visit.paidUntil);
  const dueHere = outlet ? outletDue(visit, outlet) : 0;
  const extensionDue = playDue(visit);
  const grouped = menu.reduce<Record<string, MenuItem[]>>((acc, item) => {
    acc[item.category] = acc[item.category] ?? [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xl tracking-[0.16em]">{visit.code}</p>
              <p className="text-sm text-muted-foreground">
                {formatPhone(visit.phone)}
                {visit.guardianName ? ` · ${visit.guardianName}` : ""} · {visit.childCount} children
              </p>
            </div>
            <p className={left < 0 && visit.status === "open" ? "font-medium text-destructive" : "font-medium"}>
              {visit.status === "settled"
                ? `Closed ${visit.closedAt ? formatWhen(visit.closedAt) : ""}`
                : left >= 0
                  ? `${left} min left, until ${formatWhen(visit.paidUntil)}`
                  : `${Math.abs(left)} min overtime`}
            </p>
          </div>
        </div>

        {outlet && visit.status === "open" ? (
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, items]) => (
              <section key={category}>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">{category}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((item, index) => (
                    <form key={item.id} action={addItemAction}>
                      <input type="hidden" name="visitId" value={visit.id} />
                      <input type="hidden" name="code" value={visit.code} />
                      <input type="hidden" name="outlet" value={outlet} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        className={`h-auto w-full flex-col items-start gap-1 px-3 py-4 text-left whitespace-normal transition hover:-translate-y-0.5 ${TILES[index % TILES.length]}`}
                      >
                        <span className="font-heading text-lg">{item.name}</span>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium">{formatNu(item.priceNu)}</span>
                      </Button>
                    </form>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {allowExtend && visit.status === "open" ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Add play time</h3>
            <div className="flex flex-wrap gap-2">
              {rates.map((rate) => (
                <form key={rate.minutes} action={addPlayAction}>
                  <input type="hidden" name="visitId" value={visit.id} />
                  <input type="hidden" name="code" value={visit.code} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="minutes" value={rate.minutes} />
                  <Button type="submit" variant="outline" className="h-11 px-3">
                    +{rate.minutes} min · {formatNu(rate.amountNu)}
                  </Button>
                </form>
              ))}
              {visit.blocks.some((block) => !block.paid) ? (
                <form action={removePlayAction}>
                  <input type="hidden" name="visitId" value={visit.id} />
                  <input type="hidden" name="code" value={visit.code} />
                  <input type="hidden" name="back" value={back} />
                  <Button type="submit" variant="ghost" className="h-11">
                    Remove unpaid play
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <aside className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h3 className="font-heading text-xl">Tab</h3>
        <ul className="space-y-2 text-sm">
          {visit.blocks.map((block) => (
            <li key={block.id} className="flex justify-between gap-3">
              <span>
                Play {block.minutes} min {block.paid ? "paid" : "due"}
              </span>
              <span>{formatNu(block.amountNu)}</span>
            </li>
          ))}
          {visit.lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between gap-2">
              <span>
                {line.name}
                <span className="block text-xs text-muted-foreground">
                  {line.outlet} · {line.paid ? "paid" : "open"}
                </span>
              </span>
              <span className="flex items-center gap-1">
                {outlet && line.outlet === outlet && !line.paid ? (
                  <>
                    <form action={qtyAction}>
                      <input type="hidden" name="lineId" value={line.id} />
                      <input type="hidden" name="code" value={visit.code} />
                      <input type="hidden" name="outlet" value={outlet} />
                      <input type="hidden" name="delta" value={-1} />
                      <Button type="submit" variant="ghost" size="icon" aria-label={`Remove one ${line.name}`}>
                        −
                      </Button>
                    </form>
                    <span>{line.qty}</span>
                    <form action={qtyAction}>
                      <input type="hidden" name="lineId" value={line.id} />
                      <input type="hidden" name="code" value={visit.code} />
                      <input type="hidden" name="outlet" value={outlet} />
                      <input type="hidden" name="delta" value={1} />
                      <Button type="submit" variant="ghost" size="icon" aria-label={`Add one ${line.name}`}>
                        +
                      </Button>
                    </form>
                  </>
                ) : (
                  <span>× {line.qty}</span>
                )}
                <span className="w-16 text-right">{formatNu(line.amountNu)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t pt-3 font-medium">
          <span>{outlet ? "Due at this counter" : "Still due"}</span>
          <span>{formatNu(outlet ? dueHere : visit.dueNu)}</span>
        </p>

        {outlet && visit.status === "open" && dueHere > 0 ? (
          <PayActions
            action={payOutletAction}
            amountNu={dueHere}
            staticPayload={staticPayload}
            note={`${outlet} ${visit.code}`}
            visit={visit}
            extra={<input type="hidden" name="outlet" value={outlet} />}
            cashLabel="Cash received here"
            bankLabel="Bank payment received here"
          />
        ) : null}

        {allowExtend && visit.status === "open" && extensionDue > 0 ? (
          <PayActions
            action={payPlayAction}
            amountNu={extensionDue}
            staticPayload={staticPayload}
            note={`Play ${visit.code}`}
            visit={visit}
            extra={<input type="hidden" name="back" value={back} />}
            cashLabel="Cash for added play"
            bankLabel="Bank QR for added play"
          />
        ) : null}

        {allowSettle && visit.status === "open" ? (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm text-muted-foreground">
              Closing takes food, unpaid play, and any time they stayed past their play, then ends the visit.
              {visit.overtime ? ` ${overtimeSentence(visit.overtime)}` : ""}
            </p>
            {visit.dueNu > 0 ? (
              <PayQr staticPayload={staticPayload} amountNu={visit.dueNu} note={`Bill ${visit.code}`} />
            ) : (
              <p className="text-sm">Nothing is due. You can close the visit.</p>
            )}
            <form action={settleAction} className="flex flex-col gap-2">
              <input type="hidden" name="visitId" value={visit.id} />
              <input type="hidden" name="code" value={visit.code} />
              <Button type="submit" name="method" value="cash" className="h-11">
                {visit.dueNu > 0 ? `Cash ${formatNu(visit.dueNu)} and close` : "Close visit"}
              </Button>
              {visit.dueNu > 0 ? (
                <Button type="submit" name="method" value="bank_qr" variant="outline" className="h-11">
                  Bank payment received and close
                </Button>
              ) : null}
            </form>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function PayActions({
  action,
  amountNu,
  staticPayload,
  note,
  visit,
  extra,
  cashLabel,
  bankLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  amountNu: number;
  staticPayload: string;
  note: string;
  visit: VisitView;
  extra: React.ReactNode;
  cashLabel: string;
  bankLabel: string;
}) {
  return (
    <div className="space-y-3 border-t pt-3">
      <PayQr staticPayload={staticPayload} amountNu={amountNu} note={note} />
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="visitId" value={visit.id} />
        <input type="hidden" name="code" value={visit.code} />
        {extra}
        <Button type="submit" name="method" value="cash" className="h-11">
          {cashLabel}
        </Button>
        <Button type="submit" name="method" value="bank_qr" variant="outline" className="h-11">
          {bankLabel}
        </Button>
      </form>
    </div>
  );
}
