import { VoiceTillCommandSchema, type VoiceTillCommand } from "@/lib/pulse/voiceIntentSchema";

const WORD_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function wordOrDigit(raw: string): number | null {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const w = WORD_NUM[raw.toLowerCase()];
  return w ?? null;
}

function parseMinutes(text: string): number | null {
  const hour = text.match(/(\d+|one|two|three)\s*(?:hours?|hrs?)/i);
  if (hour) {
    const h = wordOrDigit(hour[1]);
    if (h) return h * 60;
  }
  const min = text.match(/(\d+)\s*(?:mins?|minutes?)/i);
  if (min) return Number(min[1]);
  const half = /\bhalf\s*(?:an?\s*)?hour/i.test(text);
  if (half) return 30;
  return null;
}

function parseChildren(text: string): number | null {
  const kids =
    text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:kids?|children|child)/i) ||
    text.match(/(?:kids?|children)\s*[:\s]+(\d+)/i);
  if (kids) return wordOrDigit(kids[1]);
  return null;
}

function parseSocks(text: string): number | null {
  const pairs =
    text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:pairs?\s+of\s+)?socks?/i) ||
    text.match(/socks?\s*[:\s]+(\d+)/i);
  if (pairs) return wordOrDigit(pairs[1]);
  return null;
}

function parseTicketRef(text: string): string | undefined {
  const tj = text.match(/\b(TJ[-\s]?\d+)\b/i);
  if (tj) return tj[1].replace(/\s+/g, "-").toUpperCase();
  const phone = text.match(/\b(17\d{6}|77\d{6})\b/);
  if (phone) return phone[1];
  return undefined;
}

function parseGuardianName(text: string): string | undefined {
  const extend = text.match(/extend\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:play|pass|by)/i);
  if (extend) return extend[1].trim();
  return undefined;
}

function parseAddItems(text: string): VoiceTillCommand["items"] | undefined {
  const addBlock = text.match(/add\s+(.+?)(?:\s+to\s+ticket|\s+on\s+ticket|$)/i);
  if (!addBlock) return undefined;
  const segment = addBlock[1];
  const qtyName = segment.match(/(\d+)\s+(.+)/);
  if (qtyName) {
    const qty = Number(qtyName[1]);
    const name = qtyName[2].replace(/\s+and\s+.+/i, "").trim();
    const outlet = /fries|burger|pizza|kot|restaurant/i.test(name) ? ("restaurant" as const) : ("cafe" as const);
    return [{ name, qty, outlet }];
  }
  const andParts = segment.split(/\s+and\s+/i);
  if (andParts.length > 1) {
    return andParts.map((part) => {
      const m = part.trim().match(/^(\d+)\s+(.+)$/);
      if (m) return { name: m[2].trim(), qty: Number(m[1]), outlet: "cafe" as const };
      return { name: part.trim(), qty: 1, outlet: "cafe" as const };
    });
  }
  if (segment.trim()) return [{ name: segment.trim(), qty: 1, outlet: "cafe" as const }];
  return undefined;
}

function inferAction(text: string): VoiceTillCommand["action"] {
  const lower = text.toLowerCase();
  if (/\b(settle|checkout|pay\s+cash|close\s+tab)\b/.test(lower)) return "settle";
  if (/\b(extend|extension|more\s+time)\b/.test(lower)) return "extend_play";
  if (/\b(add|order|extra)\b/.test(lower)) return "add_item";
  if (/\b(lookup|find|search)\b/.test(lower)) return "lookup";
  if (parseChildren(lower) != null || /\badmission\b/.test(lower) || /\bcheck[\s-]?in\b/.test(lower)) {
    return "admission";
  }
  if (parseMinutes(lower) != null && parseChildren(lower) != null) return "admission";
  return "lookup";
}

function scoreConfidence(draft: Omit<VoiceTillCommand, "confidence">): number {
  let score = 0.5;
  if (draft.action === "admission" && draft.children != null) score += 0.15;
  if (draft.action === "admission" && draft.playMinutes != null) score += 0.1;
  if (draft.socks != null && draft.socks > 0) score += 0.05;
  if (draft.action === "add_item" && draft.items?.length) score += 0.25;
  if (draft.action === "extend_play" && (draft.playMinutes != null || draft.guardianName)) score += 0.2;
  if (draft.targetTicketOrPhone) score += 0.1;
  if (draft.action === "settle") score += 0.15;
  if (draft.rawTranscript.length > 12) score += 0.05;
  return Math.min(0.9, Math.max(0.5, score));
}

/** Heuristic parser: transcript → structured till command (Pulse Phase 7). */
export function parseVoiceIntent(transcript: string): VoiceTillCommand {
  const rawTranscript = transcript.trim();
  const lower = rawTranscript.toLowerCase();
  const action = inferAction(lower);
  const children = action === "admission" ? parseChildren(lower) ?? undefined : undefined;
  const playMinutes =
    action === "extend_play" || action === "admission" ? parseMinutes(lower) ?? undefined : undefined;
  const socks = parseSocks(lower) ?? undefined;
  const targetTicketOrPhone = parseTicketRef(rawTranscript);
  const guardianName = parseGuardianName(rawTranscript);
  const items = action === "add_item" ? parseAddItems(rawTranscript) : undefined;

  const draft: Omit<VoiceTillCommand, "confidence"> = {
    action,
    rawTranscript,
    ...(targetTicketOrPhone ? { targetTicketOrPhone } : {}),
    ...(guardianName ? { guardianName } : {}),
    ...(children != null ? { children } : {}),
    ...(playMinutes != null ? { playMinutes } : {}),
    ...(socks != null ? { socks } : {}),
    ...(items?.length ? { items } : {}),
  };

  const confidence = scoreConfidence(draft);
  const parsed = VoiceTillCommandSchema.safeParse({ ...draft, confidence });
  if (parsed.success) return parsed.data;

  return VoiceTillCommandSchema.parse({
    action: "lookup",
    rawTranscript,
    confidence: 0.5,
  });
}
