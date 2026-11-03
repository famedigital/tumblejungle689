import { BankOcrResultSchema, type BankOcrResult, type DetectedBank } from "@/lib/pulse/bankOcrSchema";
import { journalRef, parseJournal } from "@/lib/journal";

function detectBank(text: string): DetectedBank {
  const t = text.toLowerCase();
  if (/mbob|m[\s-]?bob|mobile banking of bhutan/i.test(t)) return "mBoB";
  if (/\bbnb\b|bhutan national bank/i.test(t)) return "BNB";
  if (/\bbdbl\b|bhutan development bank/i.test(t)) return "BDBL";
  if (/druk\s*pn?b|druk pnb/i.test(t)) return "Druk PNB";
  if (/t[\s-]?bank|tbank/i.test(t)) return "T-Bank";
  return "Other";
}

function extractJournalDigits(text: string): string | null {
  const parsed = parseJournal(text);
  const ref = journalRef(parsed);
  if (ref) {
    const digits = ref.replace(/\D/g, "");
    if (digits.length >= 6 && digits.length <= 12) return ref.replace(/\s+/g, "");
    if (digits.length >= 4) return ref;
  }
  const jrnl =
    text.match(/jrnl\.?\s*no\.?\s*[:#]?\s*([0-9]{6,12})/i) ||
    text.match(/journal\s*(?:ref|no|number)?\s*[:#]?\s*([0-9]{6,12})/i) ||
    text.match(/\b([0-9]{8,12})\b/);
  if (jrnl) return jrnl[1];
  const dashed = text.match(/\b(\d{3}-\d{6,9})\b/);
  if (dashed) return dashed[1];
  return null;
}

function extractAmountNu(text: string): number | null {
  const parsed = parseJournal(text);
  if (parsed.amount != null && parsed.amount > 0) return parsed.amount;
  const cleaned = text.replace(/,/g, "");
  const labeled = cleaned.match(/amount\s*:?\s*(?:nu\.?\s*)?(\d+(?:\.\d{1,2})?)/i);
  if (labeled) return Number(labeled[1]);
  const nuHits = [...cleaned.matchAll(/(?:nu\.?\s*|ngultrum\s*)(\d+(?:\.\d{1,2})?)/gi)];
  if (nuHits.length) {
    const last = nuHits[nuHits.length - 1];
    return last ? Number(last[1]) : null;
  }
  const decimal = cleaned.match(/\b(\d{2,5}\.\d{2})\b/);
  if (decimal) return Number(decimal[1]);
  return null;
}

function extractTimestamp(text: string): string | undefined {
  const iso = text.match(/\b(20\d{2}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)\b/);
  if (iso) return iso[1];
  const dmy = text.match(/\b(\d{2}[-/]\d{2}[-/]\d{4}\s+\d{2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\b/i);
  return dmy?.[1];
}

function scoreBankConfidence(journal: string, amount: number, bank: DetectedBank, raw: string): number {
  let c = 0.55;
  const digits = journal.replace(/\D/g, "");
  if (digits.length >= 6 && digits.length <= 12) c += 0.15;
  if (amount > 0 && amount < 1_000_000) c += 0.15;
  if (bank !== "Other") c += 0.1;
  if (/jrnl|journal|success|transfer|paid/i.test(raw)) c += 0.05;
  return Math.min(0.95, Math.max(0.5, c));
}

/** Parse OCR / pasted bank voucher text into a structured settlement result. */
export function parseBankText(rawExtractedText: string): BankOcrResult | null {
  const text = rawExtractedText.replace(/\u00a0/g, " ").trim();
  if (!text) return null;

  const journalRefStr = extractJournalDigits(text);
  const amountNu = extractAmountNu(text);
  if (!journalRefStr || amountNu == null || amountNu <= 0) return null;

  const detectedBank = detectBank(text);
  const confidence = scoreBankConfidence(journalRefStr, amountNu, detectedBank, text);
  const timestamp = extractTimestamp(text);

  const draft: BankOcrResult = {
    detectedBank,
    journalRef: journalRefStr,
    amountNu,
    confidence,
    rawExtractedText: text,
    ...(timestamp ? { timestamp } : {}),
  };

  const parsed = BankOcrResultSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}
