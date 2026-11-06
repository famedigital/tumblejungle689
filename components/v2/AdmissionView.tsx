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

type Props = {
  onSuccess?: () => void;
  /** Dense two-column layout for the desktop floor overlay (no scroll). */
  variant?: "default" | "desk";
};

function Stepper({
  label,
  hint,
  value,
  onDec,
  onInc,
  icon,
  compact,
}: {
  label: string;
  hint?: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
        compact ? "px-2.5 py-2" : "p-3.5"
      } flex flex-col justify-between shadow-sm`}
    >
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 gap-1">
        <span className="flex items-center gap-1 truncate">
          {icon} {label}
        </span>
        {hint ? <span className="text-[10px] font-normal shrink-0">{hint}</span> : null}
      </div>
      <div className={`flex items-center justify-between ${compact ? "mt-1.5" : "mt-2"}`}>
        <button
          type="button"
          onClick={onDec}
          className={`${
            compact ? "h-8 w-8 text-base" : "h-10 w-10 text-lg"
          } rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center`}
        >
          -
        </button>
        <span
          className={`${
            compact ? "text-xl" : "text-2xl"
          } font-black tabular-nums text-slate-900 dark:text-white`}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          className={`${
            compact ? "h-8 w-8 text-base" : "h-10 w-10 text-lg"
          } rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function AdmissionView({ onSuccess, variant = "default" }: Props) {
  const desk = variant === "desk";
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

  const rateOptions =
    rates.length > 0
      ? rates
      : [
          { minutes: 30, amountNu: 200 },
          { minutes: 60, amountNu: 350 },
          { minutes: 90, amountNu: 480 },
          { minutes: 120, amountNu: 600 },
        ];

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

  const contactBlock = (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ${
        desk ? "p-2.5 space-y-2" : "p-4 space-y-3"
      }`}
    >
      <div className={desk ? "grid grid-cols-2 gap-2" : "space-y-3"}>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
            <Phone className="h-3 w-3" /> Mobile
          </label>
          <input
            type="tel"
            required
            maxLength={8}
            placeholder="17123456"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className={`w-full font-bold font-mono tracking-wider rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white ${
              desk ? "text-base px-2.5 py-1.5" : "text-xl px-3.5 py-2.5 rounded-xl"
            }`}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
            <ShieldCheck className="h-3 w-3" /> Name (optional)
          </label>
          <input
            type="text"
            placeholder="Tenzin / Karma"
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
            className={`w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white ${
              desk ? "text-sm px-2.5 py-1.5" : "text-sm px-3.5 py-2 rounded-xl"
            }`}
          />
        </div>
      </div>
    </div>
  );

  const steppers = (
    <div className={`grid grid-cols-2 ${desk ? "gap-2" : "gap-3"}`}>
      <Stepper
        compact={desk}
        label="Children"
        value={childCount}
        icon={<Users className="h-3.5 w-3.5" />}
        onDec={() => setChildCount(Math.max(1, childCount - 1))}
        onInc={() => setChildCount(Math.min(10, childCount + 1))}
      />
      <Stepper
        compact={desk}
        label="Socks"
        hint="Nu. 50/pr"
        value={socksCount}
        icon={<Footprints className="h-3.5 w-3.5" />}
        onDec={() => setSocksCount(Math.max(0, socksCount - 1))}
        onInc={() => setSocksCount(socksCount + 1)}
      />
    </div>
  );

  const ratesBlock = (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ${
        desk ? "p-2.5" : "p-4"
      }`}
    >
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1.5">
        <Clock className="h-3 w-3" /> Play duration
      </label>
      <div className={`grid ${desk ? "grid-cols-4 gap-1.5" : "grid-cols-2 gap-2"}`}>
        {rateOptions.map((r) => {
          const active = selectedMinutes === r.minutes;
          return (
            <button
              key={r.minutes}
              type="button"
              onClick={() => setSelectedMinutes(r.minutes)}
              className={`rounded-lg border text-center transition-all ${
                desk ? "py-1.5 px-1" : "py-3 px-3 rounded-xl"
              } ${
                active
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/40 font-semibold"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              }`}
            >
              <div className={desk ? "text-[11px] leading-tight" : "text-sm"}>
                {r.minutes}
                {desk ? "m" : " Minutes"}
              </div>
              <div
                className={`font-bold text-emerald-600 dark:text-emerald-400 ${
                  desk ? "text-[10px]" : "text-xs mt-0.5"
                }`}
              >
                Nu. {r.amountNu}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const payBlock = (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ${
        desk ? "p-2.5 space-y-2 flex-1 min-h-0 flex flex-col" : "p-4 space-y-3"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
        Take payment now
      </p>
      <div className="grid grid-cols-2 gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMethod("cash")}
          className={`rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 ${
            desk ? "py-1.5" : "py-2.5 rounded-xl text-xs gap-1.5"
          } ${
            method === "cash"
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
              : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          }`}
        >
          <Banknote className="h-3.5 w-3.5" /> Cash
        </button>
        <button
          type="button"
          onClick={() => setMethod("bank_qr")}
          className={`rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 ${
            desk ? "py-1.5" : "py-2.5 rounded-xl text-xs gap-1.5"
          } ${
            method === "bank_qr"
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
              : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
          }`}
        >
          <QrCode className="h-3.5 w-3.5" /> Bank QR
        </button>
      </div>

      {method === "bank_qr" ? (
        <div className={`space-y-2 ${desk ? "min-h-0 flex-1 overflow-hidden flex flex-col" : ""}`}>
          <div
            className={`rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-1.5 ${
              desk ? "p-2 min-h-0 overflow-hidden" : "p-3 gap-2"
            }`}
          >
            <PayQr
              staticPayload={staticPayload}
              amountNu={totalNu}
              note={`Play ${selectedMinutes}m`}
              compact
            />
            {!desk && (payee || bankAccount) ? (
              <div className="text-center text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                {payee ? <p className="font-bold text-slate-900 dark:text-white">{payee}</p> : null}
                {bankAccount ? <p className="font-mono break-all">{bankAccount}</p> : null}
                <p>{city || "Thimphu"}</p>
              </div>
            ) : null}
          </div>
          <BankPick value={payBank} onChange={setPayBank} />
          <input
            type="text"
            placeholder="Journal / Ref No."
            value={journal}
            onChange={(e) => setJournal(e.target.value.slice(0, 40))}
            className="w-full font-mono text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
      ) : desk ? (
        <div className="flex-1 min-h-0 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 flex flex-col items-center justify-center gap-1 px-3 text-center">
          <Banknote className="h-6 w-6 text-emerald-600/80" />
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Cash tender</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Collect Nu. {totalNu} then admit.</p>
        </div>
      ) : null}
    </div>
  );

  const submitBlock = (
    <div className={desk ? "shrink-0 space-y-1.5" : "pt-1"}>
      <div className={`flex items-center justify-between ${desk ? "" : "px-2 mb-2"} text-sm`}>
        <span className="text-slate-500 dark:text-slate-400 text-xs">Total due</span>
        <span
          className={`font-extrabold tabular-nums text-slate-900 dark:text-white ${
            desk ? "text-lg" : "text-xl"
          }`}
        >
          Nu. {totalNu}
        </span>
      </div>
      <button
        type="submit"
        disabled={isSubmitting || phone.length < 8}
        className={`w-full px-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 active:scale-[0.985] transition-all disabled:opacity-50 disabled:pointer-events-none ${
          desk ? "py-2.5 text-sm" : "py-4 px-4 rounded-2xl text-base gap-2.5 shadow-lg"
        }`}
      >
        {isSubmitting ? <Sparkles className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        <span>Admit &amp; Print Pass</span>
      </button>
      {!desk ? (
        <p className="text-center text-[11px] text-slate-600 dark:text-slate-300 mt-1.5">
          Opens the print dialog with the play pass / wristband slip.
        </p>
      ) : null}
    </div>
  );

  const statusBanner = submittedMessage ? (
    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 shrink-0">
      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      <span>{submittedMessage}</span>
    </div>
  ) : null;

  const printPortal = passPrint ? (
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
  ) : null;

  if (desk) {
    return (
      <div className="h-full min-h-0 flex flex-col p-2.5 gap-2 overflow-hidden">
        {statusBanner}
        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-2.5 overflow-hidden"
        >
          <div className="min-h-0 flex flex-col gap-2 overflow-hidden">
            {contactBlock}
            {steppers}
            {ratesBlock}
            <div className="mt-auto rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
              {childCount} child · {selectedMinutes}m play
              {socksCount > 0 ? ` · ${socksCount} socks` : ""} · {method === "cash" ? "Cash" : payBank}
            </div>
          </div>
          <div className="min-h-0 flex flex-col gap-2 overflow-hidden">
            {payBlock}
            {submitBlock}
          </div>
        </form>
        {printPortal}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {statusBanner}
      <form onSubmit={handleSubmit} className="space-y-4">
        {contactBlock}
        {steppers}
        {ratesBlock}
        {payBlock}
        {submitBlock}
      </form>
      {printPortal}
    </div>
  );
}
