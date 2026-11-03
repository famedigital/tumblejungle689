"use client";

import { useCallback, useMemo, useState } from "react";
import { Banknote, QrCode } from "lucide-react";
import { PayQr } from "@/components/pay-qr";
import { SmartBankOcrScanner } from "@/components/cashier/SmartBankOcrScanner";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { playPaymentDing } from "@/lib/audio/sounds";
import { formatNu } from "@/lib/format";
import type { BankOcrResult, DetectedBank } from "@/lib/pulse/bankOcrSchema";

export type TillLine = { name: string; qty: number; amountNu: number };

type Props = {
  lines: TillLine[];
  serviceNu: number;
  gstNu: number;
  totalNu: number;
  staticPayload?: string;
  onSettleCash: (tenderedNu: number) => void;
  onSettleBank: (journal: string, bank: DetectedBank | string, amountNu: number) => void;
  venue?: string;
};

const DENOMS = [100, 500, 1000] as const;

export function ModernCashierTill({
  lines,
  serviceNu,
  gstNu,
  totalNu,
  staticPayload = "",
  onSettleCash,
  onSettleBank,
  venue,
}: Props) {
  const [tenderNu, setTenderNu] = useState(0);
  const [journal, setJournal] = useState("");
  const [bank, setBank] = useState<DetectedBank | string>("Other");
  const [bankAmount, setBankAmount] = useState(totalNu);

  const changeNu = useMemo(() => Math.max(0, tenderNu - totalNu), [tenderNu, totalNu]);

  const applyOcr = useCallback(
    (result: BankOcrResult) => {
      setJournal(result.journalRef);
      setBank(result.detectedBank);
      setBankAmount(result.amountNu);
    },
    [],
  );

  const settleCash = () => {
    if (tenderNu < totalNu) return;
    playPaymentDing();
    onSettleCash(tenderNu);
  };

  const settleBank = () => {
    if (!journal.trim() || bankAmount <= 0) return;
    playPaymentDing();
    onSettleBank(journal.trim(), bank, bankAmount);
  };

  const qrNote = venue ? `${venue} till` : "Tumble till";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassCard padding="lg" variant="elevated">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Order summary</h2>
            {venue ? <p className="text-sm text-slate-600 dark:text-slate-300">{venue}</p> : null}
          </div>
          <GlassBadge tone="neutral">{lines.length} lines</GlassBadge>
        </div>

        <ul className="mt-4 space-y-2">
          {lines.map((line, idx) => (
            <li
              key={`${line.name}-${idx}`}
              className="flex items-center justify-between gap-2 border-b border-slate-200/60 py-2 last:border-0 dark:border-white/10"
            >
              <span className="text-slate-800 dark:text-slate-100">
                <span className="font-semibold">{line.qty}×</span> {line.name}
              </span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatNu(line.amountNu)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 border-t border-slate-200/80 pt-3 text-sm dark:border-white/10">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>Service charge (10%)</dt>
            <dd className="tabular-nums">{formatNu(serviceNu)}</dd>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>Bhutan GST (5%)</dt>
            <dd className="tabular-nums">{formatNu(gstNu)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-base font-bold text-slate-900 dark:text-white">
            <dt>Total due</dt>
            <dd className="tabular-nums">{formatNu(totalNu)}</dd>
          </div>
        </dl>
      </GlassCard>

      <div className="space-y-4">
        <GlassCard padding="md">
          <div className="flex items-center gap-2">
            <Banknote className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <h3 className="font-bold text-slate-900 dark:text-white">Cash tender</h3>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Tap denomination or type exact tender</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {DENOMS.map((d) => (
              <GlassButton
                key={d}
                type="button"
                variant="amber"
                size="lg"
                className="min-h-11 min-w-[44px] flex-1"
                onClick={() => setTenderNu((t) => t + d)}
              >
                +{formatNu(d)}
              </GlassButton>
            ))}
            <GlassButton
              type="button"
              variant="ghost"
              size="lg"
              className="min-h-11"
              onClick={() => setTenderNu(totalNu)}
            >
              Exact
            </GlassButton>
            <GlassButton type="button" variant="ghost" size="lg" className="min-h-11" onClick={() => setTenderNu(0)}>
              Clear
            </GlassButton>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Tendered</p>
              <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{formatNu(tenderNu)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Change</p>
              <p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatNu(changeNu)}</p>
            </div>
          </div>

          <GlassButton
            type="button"
            variant="emerald"
            size="lg"
            className="mt-4 min-h-11 w-full"
            disabled={tenderNu < totalNu}
            onClick={settleCash}
          >
            Settle cash
          </GlassButton>
        </GlassCard>

        <GlassCard padding="md">
          <div className="flex items-center gap-2">
            <QrCode className="size-5 text-teal-600 dark:text-teal-400" aria-hidden />
            <h3 className="font-bold text-slate-900 dark:text-white">Bhutan RMA bank QR</h3>
          </div>
          <div className="mt-3 flex justify-center">
            <PayQr staticPayload={staticPayload} amountNu={totalNu} note={qrNote} strong showAmount />
          </div>

          <SmartBankOcrScanner expectedAmountNu={totalNu} onResult={applyOcr} className="mt-4" />

          <div className="mt-4 space-y-2">
            <label className="block text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              Journal ref
              <input
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-300/70 bg-white/80 px-3 font-mono text-base text-slate-900 dark:border-white/15 dark:bg-slate-900/60 dark:text-white"
                placeholder="40819284"
                inputMode="numeric"
              />
            </label>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              Bank
              <select
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-xl border border-slate-300/70 bg-white/80 px-3 text-base text-slate-900 dark:border-white/15 dark:bg-slate-900/60 dark:text-white"
              >
                <option value="mBoB">mBoB</option>
                <option value="BNB">BNB</option>
                <option value="BDBL">BDBL</option>
                <option value="Druk PNB">Druk PNB</option>
                <option value="T-Bank">T-Bank</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </div>

          <GlassButton
            type="button"
            variant="teal"
            size="lg"
            className="mt-4 min-h-11 w-full"
            disabled={!journal.trim()}
            onClick={settleBank}
          >
            Settle bank transfer
          </GlassButton>
        </GlassCard>
      </div>
    </div>
  );
}
