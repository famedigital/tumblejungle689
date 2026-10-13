/** Reads a Bhutan bank success screen. A miss is not a paid mark. */

export type ParsedJournal = {
  amount: number | null;
  journalId: string | null;
  rrn: string | null;
  text: string;
};

function extractAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, "").replace(/[Il](?=\d)/g, "1");
  const labeled = cleaned.match(/amount\s*:?\s*(?:nu\.?\s*)?(\d+(?:\.\d{1,2})?)/i);
  if (labeled) return Number(labeled[1]);
  const hits = [...cleaned.matchAll(/(?:nu\.?\s*)(\d+(?:\.\d{1,2})?)/gi)];
  if (hits.length) {
    const last = hits[hits.length - 1];
    return last ? Number(last[1]) : null;
  }
  const plain = cleaned.match(/\b(\d+\.\d{2})\b/);
  return plain ? Number(plain[1]) : null;
}

export function parseJournal(raw: string): ParsedJournal {
  const text = raw.replace(/\u00a0/g, " ").trim();
  const jrnl =
    text.match(/jrnl\.?\s*no\.?\s*[:#]?\s*([0-9][0-9-]{4,})/i) ||
    text.match(/\bjrnl\.?\s*[:#]?\s*([0-9]{2,}(?:-[0-9]{2,})+)/i) ||
    text.match(/\b(\d{3}-\d{8,})\b/);
  const rrno =
    text.match(/rrn[o0]?\s*[:#]?\s*([A-Z0-9-]{4,})/i) ||
    text.match(/\brr\s*no\.?\s*[:#]?\s*([A-Z0-9-]{4,})/i);
  return {
    amount: extractAmount(text),
    journalId: jrnl?.[1] ?? null,
    rrn: rrno?.[1] ?? null,
    text,
  };
}

export function journalRef(parsed: ParsedJournal): string {
  return parsed.journalId || parsed.rrn || "";
}
