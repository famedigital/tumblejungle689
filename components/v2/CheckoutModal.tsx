"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useV2Store } from "@/lib/v2/store";
import type { VisitView, PayMethod } from "@/lib/types";
import { buildDynamicEmv } from "@/lib/emv";
import { buildProfessionalWhatsAppReceipt, openWhatsAppReceipt } from "@/lib/v2/receipt-share";
import { parseJournal, journalRef } from "@/lib/journal";
import { formatPhone, formatWhen } from "@/lib/format";
import { Receipt } from "@/components/receipt";
import { PrintPortal } from "@/components/print-portal";
import { thermalPrint } from "@/lib/print-station";
import QRCode from "qrcode";
import {
  X,
  Check,
  QrCode,
  Banknote,
  Sparkles,
  Printer,
  Camera,
  MessageCircle,
  FileCheck2,
  Trash2,
} from "lucide-react";

type SlipData = {
  receiptNo: number;
  amountNu: number;
  code: string;
  when: string;
  phone: string;
  tableNo: string;
  lines: { name: string; qty: number; amount: number; paid: boolean }[];
  cash: number;
  bank: number;
  banks: { name: string; ref: string; amount: number }[];
  payMethod: PayMethod;
  playPaidNote: string;
};

function isDesktopTill() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 768px)").matches;
}

export function CheckoutModal({
  visit,
  onClose,
  onSettled,
}: {
  visit: VisitView | null;
  onClose: () => void;
  onSettled: () => void;
}) {
  const venueName = useV2Store((s) => s.venueName);
  const bankPayload = useV2Store((s) => s.bankPayload);
  const payee = useV2Store((s) => s.payee);
  const extraPerMinNu = useV2Store((s) => s.extraPerMinNu);
  const settleVisit = useV2Store((s) => s.settleVisit);
  const staff = useV2Store((s) => s.staff);

  const [method, setMethod] = useState<PayMethod>("bank_qr");
  const [selectedBank, setSelectedBank] = useState("mBOB");
  const [journalInput, setJournalInput] = useState("");
  const [customerPhone, setCustomerPhone] = useState(() =>
    visit?.phone && visit.phone !== "00000000" ? visit.phone : ""
  );
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settledData, setSettledData] = useState<SlipData | null>(null);
  const [printBusy, setPrintBusy] = useState(false);
  const [printMsg, setPrintMsg] = useState("");
  const autoPrintedRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentTime] = useState(() => Date.now());

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

  useEffect(() => {
    if (!visit || totalDueNu <= 0 || !bankPayload) return;

    let isMounted = true;
    try {
      const dynamicPayload = buildDynamicEmv(bankPayload, totalDueNu, visit.code);

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

  const runPrint = async (forceBrowser: boolean) => {
    setPrintBusy(true);
    setPrintMsg("");
    try {
      const mode = await thermalPrint("receipt", { forceBrowser });
      setPrintMsg(mode === "browser" ? "Print dialog opened" : "Sent to print agent");
    } catch (err) {
      setPrintMsg(err instanceof Error ? err.message : "Print failed");
    } finally {
      setPrintBusy(false);
      window.setTimeout(() => setPrintMsg(""), 4000);
    }
  };

  // After settle, open system print dialog on desktop (v1 receipt via PrintPortal).
  useEffect(() => {
    if (!settledData || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    const timer = window.setTimeout(() => {
      void runPrint(isDesktopTill());
    }, 280);
    return () => window.clearTimeout(timer);
  }, [settledData]);

  if (!visit) return null;

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setScreenshotPreview(previewUrl);
    setIsOcrProcessing(true);

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const ret = await worker.recognize(previewUrl);
      const text = ret.data.text;
      await worker.terminate();

      const parsed = parseJournal(text);
      const extractedRef = journalRef(parsed);
      if (extractedRef) {
        setJournalInput(extractedRef.replace(/\s+/g, ""));
      } else {
        const regexMatch =
          text.match(/(?:jrnl|journal|ref)[\s.:#]*([0-9-]{6,14})/i) ||
          text.match(/\b([0-9]{3}-[0-9]{6,8})\b/) ||
          text.match(/\b([0-9]{7,12})\b/);
        if (regexMatch) {
          setJournalInput(regexMatch[1]);
        }
      }

      if (/mbob/i.test(text)) setSelectedBank("mBOB");
      else if (/bdb/i.test(text)) setSelectedBank("BDB");
      else if (/bnb/i.test(text)) setSelectedBank("BNB");
      else if (/druk/i.test(text)) setSelectedBank("Druk PNB");
    } catch (err) {
      console.warn("OCR recognition error:", err);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const buildSlip = (receiptNo: number): SlipData => {
    const prepaidPlay = visit.blocks.filter((block) => block.paid);
    const settlePlay = visit.blocks.filter((block) => !block.paid);
    const cash = method === "cash" ? totalDueNu : 0;
    const bank = method === "bank_qr" ? totalDueNu : 0;
    return {
      receiptNo,
      amountNu: totalDueNu,
      code: visit.code,
      when: new Date().toISOString(),
      phone: visit.phone,
      tableNo: visit.tableNo || "",
      lines: [
        ...settlePlay.map((block) => ({
          name: `Play ${block.minutes} min`,
          qty: 1,
          amount: block.amountNu,
          paid: true,
        })),
        ...(isOvertime && overtimeNu > 0
          ? [{ name: `Extra ${Math.abs(diffMin)} min`, qty: 1, amount: overtimeNu, paid: true }]
          : []),
        ...visit.lines
          .filter((line) => !line.paid)
          .map((line) => ({
            name: line.name,
            qty: line.qty,
            amount: line.amountNu,
            paid: true,
          })),
      ],
      cash,
      bank,
      banks: bank > 0 ? [{ name: selectedBank, ref: journalInput.trim(), amount: bank }] : [],
      payMethod: method,
      playPaidNote: prepaidPlay.length
        ? `Play pass paid at check-in (${prepaidPlay.map((block) => `${block.minutes} min`).join(", ")})`
        : "",
    };
  };

  const handleConfirmSettle = async () => {
    setIsSubmitting(true);

    const res = await settleVisit({
      visitId: visit.id,
      method,
      amountNu: totalDueNu,
      journal: method === "bank_qr" ? journalInput.trim() : "",
      payBank: method === "bank_qr" ? selectedBank : "",
      printReceipt: true,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setSettledData(buildSlip(res.receiptNo || visit.receiptNo || visit.id));
      onSettled();
    } else {
      alert(res.error || "Settlement failed");
    }
  };

  const handleSendWhatsApp = () => {
    if (!visit || !settledData) return;

    const receiptText = buildProfessionalWhatsAppReceipt({
      venueName: venueName || "Tumble Jungle",
      tagline: "Indoor playground, cafe, and restaurant in Changjiji",
      address: "Changjiji, Thimphu",
      phone: "17123456",
      receiptNo: settledData.receiptNo,
      code: settledData.code,
      guardianName: visit.guardianName,
      customerPhone: customerPhone || visit.phone,
      childCount: visit.childCount,
      durationMinutes: visit.blocks?.[0]?.minutes || 60,
      playNu: unpaidPlayNu,
      lines: visit.lines.map((l) => ({ name: l.name, qty: l.qty, amountNu: l.amountNu })),
      overtimeNu: overtimeNu,
      overtimeMin: isOvertime ? Math.abs(diffMin) : 0,
      totalPaidNu: settledData.amountNu,
      method,
      payBank: selectedBank,
      journalRef: journalInput.trim(),
      staffName: staff?.staffName || "Floor Staff",
      thanksNote: "Thank you for visiting Tumble Jungle! See you again soon!",
    });

    openWhatsAppReceipt(customerPhone || visit.phone, receiptText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-4 sm:p-5 text-slate-900 dark:text-slate-100 flex flex-col max-h-[92vh] overflow-y-auto ${
          settledData ? "max-w-3xl" : "max-w-sm"
        }`}
      >
        {settledData ? (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="h-14 w-14 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Check className="h-7 w-7 stroke-[3]" />
              </div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white mt-3">Payment Settled!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Receipt #{settledData.receiptNo} • Nu. {settledData.amountNu}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* Same v1 Receipt component + CSS used by /receipt and cashier till */}
              <div className="receipt-preview mx-auto w-full max-w-[280px] overflow-hidden">
                <Receipt
                  screenOnly
                  venue={venueName || "Tumble Jungle"}
                  address="Changjiji, Thimphu"
                  when={formatWhen(settledData.when)}
                  code={settledData.code}
                  phone={formatPhone(settledData.phone)}
                  lines={settledData.lines}
                  total={settledData.amountNu}
                  cash={settledData.cash}
                  bank={settledData.bank}
                  banks={settledData.banks}
                  number={settledData.receiptNo}
                  payMethod={settledData.payMethod}
                  staffName={staff?.staffName || ""}
                  tableNo={settledData.tableNo}
                  playPaidNote={settledData.playPaidNote}
                />
              </div>

              <div className="space-y-3 no-print">
                <button
                  type="button"
                  disabled={printBusy}
                  onClick={() => void runPrint(true)}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  <span>{printBusy ? "Printing…" : "PRINT RECEIPT"}</span>
                </button>
                {printMsg ? (
                  <p className="text-[11px] text-center font-medium text-emerald-700 dark:text-emerald-300">{printMsg}</p>
                ) : (
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                    Opens the Windows / Chrome print dialog with the till receipt layout.
                  </p>
                )}

                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-500/30 space-y-2.5 text-left">
                  <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                    Customer WhatsApp Phone
                  </label>
                  <input
                    type="tel"
                    maxLength={8}
                    placeholder="17xxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="w-full font-mono font-bold text-base px-3 py-2 rounded-xl border border-emerald-400/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 active:scale-[0.98] transition-all"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>SEND WHATSAPP RECEIPT</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Done & Close
                </button>
              </div>
            </div>

            {/* Direct body child so browser print CSS can find it (same as v1 till). */}
            <PrintPortal>
              <Receipt
                venue={venueName || "Tumble Jungle"}
                address="Changjiji, Thimphu"
                when={formatWhen(settledData.when)}
                code={settledData.code}
                phone={formatPhone(settledData.phone)}
                lines={settledData.lines}
                total={settledData.amountNu}
                cash={settledData.cash}
                bank={settledData.bank}
                banks={settledData.banks}
                number={settledData.receiptNo}
                payMethod={settledData.payMethod}
                staffName={staff?.staffName || ""}
                tableNo={settledData.tableNo}
                playPaidNote={settledData.playPaidNote}
              />
            </PrintPortal>
          </div>
        ) : (
          <>
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

            <div className="py-2.5 space-y-1.5 text-xs">
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

            {method === "bank_qr" && (
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col items-center">
                  {qrDataUrl ? (
                    <>
                      <div className="bg-white p-2.5 rounded-2xl shadow-inner border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrDataUrl}
                          alt="Bhutan RMA Dynamic QR"
                          className="w-40 h-40 object-contain"
                        />
                      </div>
                      <div className="mt-1.5 text-center">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          Parent scans with mBOB / BDB / DrukPay
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          Payee: {payee} • Nu. {totalDueNu}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 py-4 text-center">Configure Bank Payload in Admin.</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Select Customer Bank
                  </label>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {["mBOB", "BDB", "BNB", "Druk PNB", "T-Bank"].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBank(b)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${
                          selectedBank === b
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                      Bank Verification
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Snap / Upload Screenshot</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleScreenshotChange}
                      className="hidden"
                    />
                  </div>

                  {screenshotPreview && (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="h-10 w-10 object-cover rounded-lg border"
                      />
                      <div className="flex-1 text-[11px]">
                        {isOcrProcessing ? (
                          <span className="text-amber-500 font-medium flex items-center gap-1">
                            <Sparkles className="h-3 w-3 animate-spin" /> Scanning Journal No...
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Screenshot verified
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setScreenshotPreview(null);
                          setJournalInput("");
                        }}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      Journal Ref / Transaction Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 126-1234567 or 892341"
                      value={journalInput}
                      onChange={(e) => setJournalInput(e.target.value)}
                      className="w-full font-mono font-semibold text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmSettle}
              disabled={isSubmitting}
              className="mt-3 w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  <span>CONFIRM PAYMENT & PRINT RECEIPT</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
