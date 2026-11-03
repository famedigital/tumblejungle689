"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, ClipboardPaste, Loader2, ScanLine } from "lucide-react";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import type { BankOcrResult } from "@/lib/pulse/bankOcrSchema";
import { parseBankText } from "@/lib/pulse/parseBankText";
import { formatNu } from "@/lib/format";

type Props = {
  onResult: (result: BankOcrResult) => void;
  expectedAmountNu?: number;
  className?: string;
};

export function SmartBankOcrScanner({ onResult, expectedAmountNu, className }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BankOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runOcr = useCallback(
    async (source: File | Blob) => {
      setBusy(true);
      setError(null);
      try {
        const url = URL.createObjectURL(source);
        setPreview(url);
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        try {
          const { data } = await worker.recognize(source);
          const parsed = parseBankText(data.text || "");
          if (!parsed) {
            setLastResult(null);
            setError("Could not read journal ref or amount. Try a clearer screenshot.");
            return;
          }
          if (expectedAmountNu != null && Math.abs(parsed.amountNu - expectedAmountNu) > 1) {
            setError(`Amount ${formatNu(parsed.amountNu)} does not match bill ${formatNu(expectedAmountNu)}.`);
          }
          setLastResult(parsed);
          onResult(parsed);
        } finally {
          await worker.terminate();
        }
      } catch {
        setError("OCR failed. Paste an image or retake the photo.");
      } finally {
        setBusy(false);
      }
    },
    [expectedAmountNu, onResult],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void runOcr(file);
    e.target.value = "";
  };

  const onPaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        void runOcr(blob);
        return;
      }
      setError("Clipboard has no image. Copy a bank success screenshot first.");
    } catch {
      setError("Paste permission denied. Use camera upload instead.");
    }
  };

  const verified = lastResult != null && lastResult.confidence > 0.7;

  return (
    <GlassCard padding="md" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Scan bank voucher
          </p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Camera or paste mBoB / BNB / BDBL success screen
          </p>
        </div>
        {verified ? (
          <GlassBadge tone="active" dot className="border-emerald-500/40 bg-emerald-500/15">
            Verified OCR
          </GlassBadge>
        ) : lastResult ? (
          <GlassBadge tone="warning">Review match</GlassBadge>
        ) : null}
      </div>

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Voucher preview"
          className="mt-3 max-h-40 w-full rounded-xl border border-slate-200/80 object-contain dark:border-white/10"
        />
      ) : null}

      {lastResult ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Bank</dt>
            <dd className="font-semibold text-slate-800 dark:text-slate-100">{lastResult.detectedBank}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Journal</dt>
            <dd className="font-mono font-semibold text-slate-800 dark:text-slate-100">{lastResult.journalRef}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Amount</dt>
            <dd className="text-lg font-bold text-slate-900 dark:text-white">{formatNu(lastResult.amountNu)}</dd>
          </div>
        </dl>
      ) : null}

      {error ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onFileChange}
        />
        <GlassButton
          type="button"
          variant="teal"
          size="lg"
          className="min-h-11 min-w-[44px]"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
          {busy ? "Reading…" : "Camera / photo"}
        </GlassButton>
        <GlassButton
          type="button"
          variant="slate"
          size="lg"
          className="min-h-11 min-w-[44px]"
          disabled={busy}
          onClick={() => void onPaste()}
        >
          <ClipboardPaste className="size-5" aria-hidden />
          Paste image
        </GlassButton>
      </div>

      {!lastResult && !busy ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <ScanLine className="size-4 shrink-0" aria-hidden />
          Jrnl 6–12 digits and Nu. amount are auto-filled for settlement.
        </p>
      ) : null}
    </GlassCard>
  );
}
