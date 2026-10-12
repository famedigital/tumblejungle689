export const POLE_CHANNEL = "tumble-pole";
export const POLE_LAST_KEY = "tumble-pole-last";

export type PoleLine = {
  name: string;
  qty: number;
  amount: number;
  paid: boolean;
};

export type PolePayload = {
  shop: string;
  code: string;
  phone: string;
  lines: PoleLine[];
  due: number;
  payNu: number;
  qr: string;
  extra: string;
  thanks: boolean;
};

export type PoleHello = { kind: "pole-hello" };

export function isPoleHello(msg: unknown): msg is PoleHello {
  return Boolean(msg && typeof msg === "object" && (msg as PoleHello).kind === "pole-hello");
}

export function isPolePayload(msg: unknown): msg is PolePayload {
  if (!msg || typeof msg !== "object") return false;
  const row = msg as Record<string, unknown>;
  return (
    typeof row.shop === "string" &&
    typeof row.code === "string" &&
    typeof row.due === "number" &&
    typeof row.qr === "string" &&
    Array.isArray(row.lines)
  );
}

export function poleReadLast(): PolePayload | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(POLE_LAST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPolePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function poleWriteLast(payload: PolePayload) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(POLE_LAST_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

export function polePost(payload: PolePayload) {
  poleWriteLast(payload);
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(POLE_CHANNEL);
  channel.postMessage(payload);
  channel.close();
}

export function poleHello() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(POLE_CHANNEL);
  channel.postMessage({ kind: "pole-hello" } satisfies PoleHello);
  channel.close();
}
