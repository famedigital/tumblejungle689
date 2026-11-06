"use client";

import { useEffect, useState, useMemo } from "react";
import { useV2Store } from "@/lib/v2/store";
import type { VisitView, PayMethod } from "@/lib/types";
import { buildDynamicEmv } from "@/lib/emv";
import QRCode from "qrcode";
import { X, Check, QrCode, Banknote, Sparkles, Printer } from "lucide-react";

export function CheckoutModal({
  visit,
  onClose,
  onSettled,
}: {
  visit: VisitView | null;
  onClose: () => void;
  onSettled: () => void;
}) {
  const bankPayload = useV2Store((s) => s.bankPayload);
  const payee = useV2Store((s) => s.payee);
  const extraPerMinNu = useV2Store((s) => s.extraPerMinNu);
  const settleVisit = useV2Store((s) => s.settleVisit);

  const [method, setMethod] = useState<PayMethod>("bank_qr");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settledSuccess, setSettledSuccess] = useState(false);
  const [currentTime] = useState(() => Date.now());

  // Calculate Overtime & Totals
  const { isOvertime, overtimeNu, diffMin, unpaidPlayNu, unpaidFoodNu, totalDueNu } = useMemo(() => {
    if (!visit) {
      return {
        isOvertime: false,
        overtimeNu: 0,
        diffMin: 0,
        unpaidPlayNu: 0,
        unpaidFoodNu: 0,
        totalDueNu: 0,
      };
    }
    const paidUntilMs = new Date(visit.paidUntil).getTime();
    const diff = Math.round((paidUntilMs - currentTime) / 60000);
    const ot = diff < 0;
    const otNu = ot ? Math.abs(diff) * (extraPerMinNu || 10) : 0;
    const foodNu = visit.lines.filter((l) => !l.paid).reduce((sum, l) => sum + l.amountNu, 0);
    const playNu = visit.blocks.filter((b) => !b.paid).reduce((sum, b) => sum + b.amountNu, 0);
    const total = Math.max(0, foodNu + playNu + otNu);

    return {
      isOvertime: ot,
      overtimeNu: otNu,
      diffMin: diff,
      unpaidPlayNu: playNu,
      unpaidFoodNu: foodNu,
      totalDueNu: total,
    };
  }, [visit, currentTime, extraPerMinNu]);

  // Generate dynamic Bhutan RMA QR code
  useEffect(() => {
    if (!visit || totalDueNu <= 0 || !bankPayload) return;

    let isMounted = true;
    try {
      const dynamicPayload = buildDynamicEmv(
        bankPayload,
        totalDueNu,
        visit.code
      );

      if (dynamicPayload) {
        QRCode.toDataURL(dynamicPayload, {
          width: 280,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
        }).then((url) => {
          if (isMounted) setQrDataUrl(url);
        });
      }
    } catch (e) {
      console.error("QR generation error:", e);
    }

    return () => {
      isMounted = false;
    };
  }, [visit, totalDueNu, bankPayload]);

  if (!visit) return null;

  const handleConfirmSettle = async () => {
    setIsSubmitting(true);

    const res = await settleVisit({
      visitId: visit.id,
      method,
      amountNu: totalDueNu,
      printReceipt: true,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setSettledSuccess(true);
      setTimeout(() => {
        setSettledSuccess(false);
        onSettled();
      }, 1000);
    } else {
      alert(res.error || "Settlement failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-5 text-slate-900 dark:text-slate-100 flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-base text-slate-900 dark:text-white">
                {visit.code}
              </span>
              {visit.tableNo && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {visit.tableNo}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {visit.guardianName || "Child"} • {visit.phone}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Bill Breakdown */}
        <div className="py-3 space-y-1.5 text-xs">
          {unpaidPlayNu > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Play Admission</span>
              <span className="font-mono font-semibold">Nu. {unpaidPlayNu}</span>
            </div>
          )}

          {unpaidFoodNu > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Food & Drink Tab ({visit.lines.length} items)</span>
              <span className="font-mono font-semibold">Nu. {unpaidFoodNu}</span>
            </div>
          )}

          {isOvertime && (
            <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
              <span>Overtime (+{Math.abs(diffMin)} min)</span>
              <span className="font-mono font-semibold">Nu. {overtimeNu}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800 text-sm">
            <span className="font-bold text-slate-900 dark:text-white">Total Amount Due</span>
            <span className="font-mono font-black text-xl text-emerald-600 dark:text-emerald-400">
              Nu. {totalDueNu}
            </span>
          </div>
        </div>

        {/* Payment Method Tabs */}
        <div className="grid grid-cols-2 gap-2 my-2">
          <button
            type="button"
            onClick={() => setMethod("bank_qr")}
            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              method === "bank_qr"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Bank QR (Scan)</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod("cash")}
            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              method === "cash"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            <Banknote className="h-4 w-4" />
            <span>Cash</span>
          </button>
        </div>

        {/* Dynamic RMA QR Code Display on Staff Phone */}
        {method === "bank_qr" && (
          <div className="my-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col items-center">
            {qrDataUrl ? (
              <>
                <div className="bg-white p-2.5 rounded-2xl shadow-inner border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="Bhutan RMA Dynamic QR"
                    className="w-48 h-48 object-contain"
                  />
                </div>
                <div className="mt-2 text-center">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    Scan with mBOB / BDB / DrukPay / BNB mPay
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Payee: {payee} • Nu. {totalDueNu}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                Configure Bank Payload in Admin to render Bhutan RMA QR.
              </p>
            )}
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleConfirmSettle}
          disabled={isSubmitting}
          className="mt-3 w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {settledSuccess ? (
            <>
              <Check className="h-4 w-4 text-white" />
              <span>Settled & Receipt Spooled!</span>
            </>
          ) : isSubmitting ? (
            <Sparkles className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Printer className="h-4 w-4" />
              <span>CONFIRM PAYMENT & PRINT RECEIPT</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
