"use client";

export type PrintMode = "receipt" | "kot" | "ticket" | "sticker" | "day";

const LS_ON = "tumble-print-agent-on";
const LS_TOKEN = "tumble-print-agent-token";

export type PrintStationConfig = {
  url?: string;
  token: string;
  on?: boolean;
};

export function readPrintStationConfig(fallback?: Partial<PrintStationConfig>): PrintStationConfig | null {
  let on = false;
  let token = "";
  try {
    on = localStorage.getItem(LS_ON) === "1";
    token = (localStorage.getItem(LS_TOKEN) || "").trim();
  } catch {
    /* private mode */
  }
  if (fallback?.on != null) on = Boolean(fallback.on) || on;
  if (!token) token = (fallback?.token || "").trim();
  if (!on) return null;
  return { token: token || "tumble-print", on: true };
}

export function writePrintStationConfig(config: PrintStationConfig) {
  try {
    localStorage.setItem(LS_ON, config.on === false ? "0" : "1");
    localStorage.setItem(LS_TOKEN, config.token || "tumble-print");
  } catch {
    /* ignore */
  }
}

function selectorFor(mode: PrintMode): string {
  if (mode === "receipt") return ".print-receipt";
  if (mode === "kot") return ".print-kot";
  if (mode === "day") return ".print-day-report";
  if (mode === "sticker") return ".print-sticker, .print-sticker-sheet";
  return ".print-ticket, .print-sticker";
}

export function slipTextForPrint(mode: PrintMode): string {
  const nodes = document.querySelectorAll(selectorFor(mode));
  const parts: string[] = [];
  nodes.forEach((node) => {
    const text = (node as HTMLElement).innerText || node.textContent || "";
    const clean = text.replace(/\n{3,}/g, "\n\n").trim();
    if (clean) parts.push(clean);
  });
  return parts.join("\n\n---\n\n");
}

async function enqueueCloud(mode: PrintMode, text: string): Promise<boolean> {
  try {
    const res = await fetch("/api/print/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: mode, mode, text }),
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return Boolean(body?.ok);
  } catch {
    return false;
  }
}

function browserPrint(mode: PrintMode) {
  document.body.dataset.print = mode;
  const finish = () => {
    delete document.body.dataset.print;
    window.removeEventListener("afterprint", finish);
  };
  window.addEventListener("afterprint", finish);
  window.setTimeout(finish, 8000);
  window.print();
}

/**
 * Queue slip for the PC print agent (cloud poll). Falls back to window.print().
 */
export async function thermalPrint(
  mode: PrintMode,
  fallback?: Partial<PrintStationConfig>,
): Promise<"station" | "browser"> {
  const config = readPrintStationConfig(fallback);
  const text = slipTextForPrint(mode);
  if (config?.on && text) {
    document.body.dataset.print = mode;
    const ok = await enqueueCloud(mode, text);
    delete document.body.dataset.print;
    if (ok) return "station";
  }
  browserPrint(mode);
  return "browser";
}

export async function pingPrintStation(): Promise<{ online: boolean; ageSec: number | null; queued: number }> {
  try {
    const res = await fetch("/api/print/status", { method: "GET", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { online: false, ageSec: null, queued: 0 };
    const body = (await res.json().catch(() => null)) as {
      online?: boolean;
      ageSec?: number | null;
      queued?: number;
    } | null;
    return {
      online: Boolean(body?.online),
      ageSec: body?.ageSec ?? null,
      queued: body?.queued ?? 0,
    };
  } catch {
    return { online: false, ageSec: null, queued: 0 };
  }
}
