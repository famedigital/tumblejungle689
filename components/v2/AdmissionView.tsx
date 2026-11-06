"use client";

import { useState } from "react";
import { useV2Store } from "@/lib/v2/store";
import { Users, Clock, Printer, Sparkles, Check, Phone, ShieldCheck, Footprints } from "lucide-react";

export function AdmissionView({ onSuccess }: { onSuccess?: () => void }) {
  const rates = useV2Store((s) => s.rates);
  const admitChild = useV2Store((s) => s.admitChild);

  const [phone, setPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [childCount, setChildCount] = useState(1);
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [socksCount, setSocksCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");

  const selectedRate = rates.find((r) => r.minutes === selectedMinutes) || {
    minutes: selectedMinutes,
    amountNu: selectedMinutes === 30 ? 200 : selectedMinutes === 60 ? 350 : 480,
  };

  const socksNu = 50;
  const playTotal = selectedRate.amountNu * childCount;
  const socksTotal = socksCount * socksNu;
  const totalNu = playTotal + socksTotal;

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
      method: "cash",
      printWristband: true,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setSubmittedMessage(`Pass ${res.visit?.code} Created & Wristband Spooled!`);
      // Reset form
      setPhone("");
      setGuardianName("");
      setChildCount(1);
      setSocksCount(0);
      setTimeout(() => {
        setSubmittedMessage("");
        onSuccess?.();
      }, 1500);
    } else {
      alert(res.error || "Failed to admit child.");
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Quick feedback banner */}
      {submittedMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{submittedMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contact Input Box */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Mobile Phone (8 Digits)
            </label>
            <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
              e.g. 17xxxxxx / 77xxxxxx
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

        {/* Children Counter & Grip Socks */}
        <div className="grid grid-cols-2 gap-3">
          {/* Children count */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Users className="h-3.5 w-3.5" /> Children
            </div>
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => setChildCount(Math.max(1, childCount - 1))}
                className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors"
              >
                -
              </button>
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {childCount}
              </span>
              <button
                type="button"
                onClick={() => setChildCount(Math.min(10, childCount + 1))}
                className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Grip Socks */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Footprints className="h-3.5 w-3.5" /> Socks
              </span>
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-normal">
                Nu. 50/pr
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => setSocksCount(Math.max(0, socksCount - 1))}
                className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors"
              >
                -
              </button>
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {socksCount}
              </span>
              <button
                type="button"
                onClick={() => setSocksCount(socksCount + 1)}
                className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Duration Selection Chips */}
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

        {/* Pricing Summary & 1-Tap Trigger */}
        <div className="pt-2">
          <div className="flex items-center justify-between px-2 mb-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Total Admission Due:</span>
            <span className="font-extrabold text-xl text-slate-900 dark:text-white">
              Nu. {totalNu}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || phone.length < 8}
            className="w-full py-4 px-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <Sparkles className="h-5 w-5 animate-spin" />
            ) : (
              <Printer className="h-5 w-5" />
            )}
            <span>ADMIT & REMOTE PRINT WRISTBAND</span>
          </button>
          <p className="text-center text-[11px] text-slate-600 dark:text-slate-300 mt-1.5">
            Wristband prints silently at counter • 0ms sync to all devices
          </p>
        </div>
      </form>
    </div>
  );
}
