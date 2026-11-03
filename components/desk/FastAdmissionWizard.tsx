"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Ticket } from "lucide-react";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { GlassChips } from "@/components/ui/glass/GlassChips";
import { playCheckInChime } from "@/lib/audio/sounds";
import { formatNu, formatPhone, normalizePhone } from "@/lib/format";
import type { Rate } from "@/lib/types";
import { cn } from "@/lib/utils";

const SOCK_NU_PER_PAIR = 50;
const FALLBACK_MINUTES = [30, 60, 90, 120] as const;

export type AdmissionIssueData = {
  phone: string;
  name: string;
  children: number;
  minutes: number;
  socks: number;
  waiver: boolean;
};

export interface FastAdmissionWizardProps {
  rates: Rate[];
  onIssue: (data: AdmissionIssueData) => void | Promise<void>;
}

type Step = 1 | 2 | 3;

function rateOptions(rates: Rate[]): Rate[] {
  if (rates.length > 0) {
    return [...rates].sort((a, b) => a.minutes - b.minutes);
  }
  return FALLBACK_MINUTES.map((minutes) => ({
    minutes,
    amountNu: minutes === 30 ? 150 : minutes === 60 ? 250 : minutes === 90 ? 350 : 450,
  }));
}

export function FastAdmissionWizard({ rates, onIssue }: FastAdmissionWizardProps) {
  const options = useMemo(() => rateOptions(rates), [rates]);
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [children, setChildren] = useState(1);
  const [minutes, setMinutes] = useState(options[0]?.minutes ?? 30);
  const [socks, setSocks] = useState(0);
  const [waiver, setWaiver] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRate = options.find((r) => r.minutes === minutes) ?? options[0];
  const playNu = (selectedRate?.amountNu ?? 0) * children;
  const socksNu = socks * SOCK_NU_PER_PAIR;
  const totalNu = playNu + socksNu;

  const phoneOk = normalizePhone(phone).length === 8;
  const nameOk = name.trim().length >= 2;

  const goIssue = useCallback(async () => {
    setError(null);
    const normalized = normalizePhone(phone);
    if (normalized.length !== 8) {
      setError("Enter an 8-digit Bhutan mobile number.");
      setStep(1);
      return;
    }
    if (!nameOk) {
      setError("Enter the guardian or family name.");
      setStep(1);
      return;
    }
    if (!waiver) {
      setError("Confirm the play waiver before issuing.");
      return;
    }
    setBusy(true);
    try {
      await onIssue({
        phone: normalized,
        name: name.trim(),
        children,
        minutes,
        socks,
        waiver,
      });
      playCheckInChime();
      setPhone("");
      setName("");
      setChildren(1);
      setMinutes(options[0]?.minutes ?? 30);
      setSocks(0);
      setWaiver(true);
      setStep(1);
    } catch (e) {
      const digest =
        e && typeof e === "object" && "digest" in e ? String((e as { digest: unknown }).digest) : "";
      if (digest.startsWith("NEXT_REDIRECT")) {
        playCheckInChime();
        throw e;
      }
      setError(e instanceof Error ? e.message : "Could not issue pass.");
    } finally {
      setBusy(false);
    }
  }, [children, minutes, nameOk, name, onIssue, options, phone, socks, waiver]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Fast admission
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Step {step} of 3 — phone, pass & socks, then issue wristband
        </p>
      </header>

      <div className="flex gap-2" aria-hidden>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              n <= step ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800",
            )}
          />
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-300/60 bg-rose-50/80 px-4 py-2 text-sm font-medium text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <GlassCard padding="lg" className="space-y-5">
          <div>
            <label
              htmlFor="admission-phone"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Guardian phone
            </label>
            <input
              id="admission-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="17xxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 text-lg font-bold text-slate-900 outline-none ring-teal-500/30 focus:ring-2 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
            />
            {phoneOk ? (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                {formatPhone(normalizePhone(phone))}
              </p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="admission-name"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Family / guardian name
            </label>
            <input
              id="admission-name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Tenzin family"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 text-lg font-semibold text-slate-900 outline-none ring-teal-500/30 focus:ring-2 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
            />
          </div>
          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Children playing
            </span>
            <div className="flex items-center gap-4">
              <GlassButton
                type="button"
                variant="slate"
                size="lg"
                aria-label="Fewer children"
                disabled={children <= 1}
                onClick={() => setChildren((c) => Math.max(1, c - 1))}
              >
                <Minus className="size-5" />
              </GlassButton>
              <span className="min-w-[3rem] text-center text-3xl font-bold text-slate-900 dark:text-white">
                {children}
              </span>
              <GlassButton
                type="button"
                variant="slate"
                size="lg"
                aria-label="More children"
                disabled={children >= 12}
                onClick={() => setChildren((c) => Math.min(12, c + 1))}
              >
                <Plus className="size-5" />
              </GlassButton>
            </div>
          </div>
          <GlassButton
            type="button"
            size="lg"
            className="w-full"
            disabled={!phoneOk || !nameOk}
            onClick={() => setStep(2)}
          >
            Continue
            <ChevronRight className="size-5" />
          </GlassButton>
        </GlassCard>
      ) : null}

      {step === 2 ? (
        <GlassCard padding="lg" className="space-y-6">
          <div>
            <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Play duration
            </span>
            <GlassChips
              value={minutes}
              onChange={setMinutes}
              options={options.map((r) => ({
                value: r.minutes,
                label: `${r.minutes} min`,
                subtext: formatNu(r.amountNu),
              }))}
            />
          </div>
          <div>
            <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Grip socks (pairs)
            </span>
            <GlassChips
              value={socks}
              onChange={setSocks}
              options={[0, 1, 2, 3].map((n) => ({
                value: n,
                label: n === 0 ? "None" : `${n} pair${n > 1 ? "s" : ""}`,
                subtext: n > 0 ? formatNu(n * SOCK_NU_PER_PAIR) : undefined,
              }))}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/50">
            <input
              type="checkbox"
              checked={waiver}
              onChange={(e) => setWaiver(e.target.checked)}
              className="mt-1 size-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Guardian confirms the play-area liability waiver is signed for today&apos;s visit.
            </span>
          </label>
          <div className="flex gap-3">
            <GlassButton type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setStep(1)}>
              <ChevronLeft className="size-5" />
              Back
            </GlassButton>
            <GlassButton type="button" size="lg" className="flex-1" onClick={() => setStep(3)}>
              Preview
              <ChevronRight className="size-5" />
            </GlassButton>
          </div>
        </GlassCard>
      ) : null}

      {step === 3 ? (
        <GlassCard padding="lg" variant="tinted" className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Ticket className="size-6" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{name.trim()}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {formatPhone(normalizePhone(phone))} · {children} child{children > 1 ? "ren" : ""}
              </p>
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-700 dark:text-slate-300">
              <dt>
                Play · {minutes} min × {children}
              </dt>
              <dd className="font-bold text-slate-900 dark:text-white">{formatNu(playNu)}</dd>
            </div>
            {socks > 0 ? (
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <dt>Socks · {socks} pair{socks > 1 ? "s" : ""}</dt>
                <dd className="font-bold text-slate-900 dark:text-white">{formatNu(socksNu)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-emerald-200/60 pt-2 dark:border-emerald-500/20">
              <dt className="font-semibold text-slate-800 dark:text-slate-100">Due at counter</dt>
              <dd className="text-xl font-bold text-slate-900 dark:text-white">{formatNu(totalNu)}</dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Issues open visit &amp; sticker print. Collect {formatNu(totalNu)} at cashier if not paid here.
          </p>
          <div className="flex gap-3">
            <GlassButton type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setStep(2)}>
              <ChevronLeft className="size-5" />
              Edit
            </GlassButton>
            <GlassButton
              type="button"
              size="lg"
              className="flex-[2]"
              loading={busy}
              disabled={!waiver}
              onClick={() => void goIssue()}
            >
              Issue &amp; print
            </GlassButton>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
