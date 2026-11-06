"use client";

import { useEffect, useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import type { PayMethod, VisitView } from "@/lib/types";
import { PayQr } from "@/components/pay-qr";
import { PlayPass } from "@/components/play-pass";
import { PrintPortal } from "@/components/print-portal";
import { BankPick } from "@/components/bank-pick";
import { staticFromSettings } from "@/lib/emv";
import { thermalPrint } from "@/lib/print-station";
import { forceLocalPrintDialog } from "@/lib/v2/print-local";
import {
  Users,
  Clock,
  Printer,
  Sparkles,
  Check,
  Phone,
  ShieldCheck,
  Footprints,
  QrCode,
  Banknote,
} from "lucide-react";

export function AdmissionView({ onSuccess }: { onSuccess?: () => void }) {
  const rates = useV2Store((s) => s.rates);
  const admitChild = useV2Store((s) => s.admitChild);
  const venueName = useV2Store((s) => s.venueName);
  const bankPayload = useV2Store((s) => s.bankPayload);
  const bankAccount = useV2Store((s) => s.bankAccount);
  const payee = useV2Store((s) => s.payee);
  const city = useV2Store((s) => s.city);

  const [phone, setPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [childCount, setChildCount] = useState(1);
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [socksCount, setSocksCount] = useState(0);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [journal, setJournal] = useState("");
  const [payBank, setPayBank] = useState("mBOB");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [passPrint, setPassPrint] = useState<{
    visit: VisitView;
    qr: string;
  } | null>(null);

  const selectedRate = rates.find((r) => r.minutes === selectedMinutes) || {
    minutes: selectedMinutes,
    amountNu: selectedMinutes === 30 ? 200 : selectedMinutes === 60 ? 350 : 480,
  };

  const socksNu = 50;
  const playTotal = selectedRate.amountNu * childCount;
  const socksTotal = socksCount * socksNu;
  const totalNu = playTotal + socksTotal;

  const staticPayload = staticFromSettings({
    payload: bankPayload || "",
    account: bankAccount || "",
    payee: payee || venueName || "Tumble Jungle",
    city: city || "Thimphu",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.length < 8) {
      alert("Please enter a valid 8-digit phone number.");
      return;
    }

    setIsSubmitting(true);
    setSubmittedMessage("");

    const res = await admitChild({
      phone: phone.trim(),
      guardianName: guardianName.trim() || "Guest",
      childCount,
      minutes: selectedMinutes,
      socksCount,
      socksNu,
      method,
      journal: method === "bank_qr" ? journal.trim() : "",
      payBank: method === "bank_qr" ? payBank : "",
      printWristband: true,
    });

    setIsSubmitting(false);

    if (res.ok && res.visit) {
      setSubmittedMessage(`Pass ${res.visit.code} created — opening print…`);
      setPhone("");
      setGuardianName("");
      setChildCount(1);
      setSocksCount(0);
      setJournal("");

      try {
        const url = `${window.location.origin}/t/${res.visit.code}`;
        const mod = await import("qrcode");
        const qr = await mod.toDataURL(url, {
          margin: 1,
          width: 360,
          errorCorrectionLevel: "M",
          color: { dark: "#1f4d3a", light: "#ffffff" },
        });
        setPassPrint({ visit: res.visit, qr });
      } catch (err) {
        console.warn("Pass QR failed:", err);
        setPassPrint({ visit: res.visit, qr: "" });
      }
    } else {
      alert(res.error || "Failed to admit child.");
    }
  };

  useEffect(() => {
    if (!passPrint) return;
    const timer = window.setTimeout(() => {
      void thermalPrint("sticker", { forceBrowser: forceLocalPrintDialog() })
        .catch((err) => console.warn("Wristband print:", err))
        .finally(() => {
          window.setTimeout(() => {
            setPassPrint(null);
            setSubmittedMessage("");
            onSuccess?.();
          }, 600);
        });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [passPrint, onSuccess]);

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {submittedMessage ? (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{submittedMessage}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Mobile Phone (8 Digits)
            </label>
            <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
              e.g. 17xxxxxx
            </span>
          </div>
          <input
            type="tel"
            required
            maxLength={8}
            placeholder="17123456"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className="w-full text-xl font-bold font-mono tracking-wider px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
          />

          <div className="pt-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Child / Parent Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Tenzin / Karma"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Users className="h-3.5 w-3.5" /> Children
            </div>
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => setChildCount(Math.max(1, childCount - 1))}
                className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center justify-center"
              >
                -
              </button>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{childCount}</span>
              <button
                type="button"
                onClick={() => setChildCount(Math.min(10, childCount + 1))}
                className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Footprints className="h-3.5 w-3.5" /> Socks
              </span>
              <span className="text-[10px] font-normal">Nu. 50/pr</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => setSocksCount(Math.max(0, socksCount - 1))}
                className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center justify-center"
              >
                -
              </button>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{socksCount}</span>
              <button
                type="button"
                onClick={() => setSocksCount(socksCount + 1)}
                className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2.5">
            <Clock className="h-3.5 w-3.5" /> Play Duration
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(rates.length > 0
              ? rates
              : [
                  { minutes: 30, amountNu: 200 },
                  { minutes: 60, amountNu: 350 },
                  { minutes: 90, amountNu: 480 },
                  { minutes: 120, amountNu: 600 },
                ]
            ).map((r) => {
              const active = selectedMinutes === r.minutes;
              return (
                <button
                  key={r.minutes}
                  type="button"
                  onClick={() => setSelectedMinutes(r.minutes)}
                  className={`py-3 px-3 rounded-xl border text-center transition-all ${
                    active
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/30 font-semibold"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="text-sm">{r.minutes} Minutes</div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Nu. {r.amountNu}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pay now — same bank QR path as v1 check-in */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Take play payment now
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod("cash")}
              className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                method === "cash"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              <Banknote className="h-4 w-4" /> Cash
            </button>
            <button
              type="button"
              onClick={() => setMethod("bank_qr")}
              className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                method === "bank_qr"
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              <QrCode className="h-4 w-4" /> Bank QR
            </button>
          </div>

          {method === "bank_qr" ? (
            <div className="space-y-3 pt-1">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 flex flex-col items-center gap-2">
                <PayQr
                  staticPayload={staticPayload}
                  amountNu={totalNu}
                  note={`Play ${selectedMinutes}m`}
                  compact
                />
                {(payee || bankAccount) && (
                  <div className="text-center text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                    {payee ? <p className="font-bold text-slate-900 dark:text-white">{payee}</p> : null}
                    {bankAccount ? <p className="font-mono break-all">{bankAccount}</p> : null}
                    <p>{city || "Thimphu"}</p>
                  </div>
                )}
              </div>
              <BankPick value={payBank} onChange={setPayBank} />
              <input
                type="text"
                placeholder="Journal / Ref No."
                value={journal}
                onChange={(e) => setJournal(e.target.value.slice(0, 40))}
                className="w-full font-mono text-xs font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          ) : null}
        </div>

        <div className="pt-1">
          <div className="flex items-center justify-between px-2 mb-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Total due</span>
            <span className="font-extrabold text-xl text-slate-900 dark:text-white">Nu. {totalNu}</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || phone.length < 8}
            className="w-full py-4 px-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? <Sparkles className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
            <span>Admit &amp; Print Pass</span>
          </button>
          <p className="text-center text-[11px] text-slate-600 dark:text-slate-300 mt-1.5">
            Opens the print dialog with the play pass / wristband slip.
          </p>
        </div>
      </form>

      {passPrint ? (
        <PrintPortal>
          <PlayPass
            venue={venueName || "Tumble Jungle"}
            code={passPrint.visit.code}
            receiptNo={passPrint.visit.receiptNo}
            phone={passPrint.visit.phone}
            qr={passPrint.qr}
            childCount={passPrint.visit.childCount}
            started={passPrint.visit.createdAt}
            ends={passPrint.visit.paidUntil}
          />
        </PrintPortal>
      ) : null}
    </div>
  );
}
