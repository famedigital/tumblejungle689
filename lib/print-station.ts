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
  return { token: token || "tumble-print", on };
}

export function writePrintStationConfig(config: PrintStationConfig) {
  try {
    localStorage.setItem(LS_ON, config.on ? "1" : "0");
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

async function slipTextWithRetry(mode: PrintMode): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const text = slipTextForPrint(mode);
    if (text) return text;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return "";
}

type EnqueueResult = "queued" | "disabled" | "failed";

async function enqueueCloud(mode: PrintMode, text: string): Promise<EnqueueResult> {
  try {
    const res = await fetch("/api/print/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: mode, mode, text }),
      credentials: "same-origin",
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; disabled?: boolean } | null;
    if (res.status === 409 || body?.disabled) return "disabled";
    if (!res.ok || !body?.ok) return "failed";
    return "queued";
  } catch {
    return "failed";
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

function notify(message: string) {
  try {
    window.alert(message);
  } catch {
    /* ignore */
  }
}

/**
 * When print station is ON (server or local): queue only — never open the browser print dialog.
 * When OFF: normal window.print().
 */
export async function thermalPrint(
  mode: PrintMode,
  fallback?: Partial<PrintStationConfig>,
): Promise<"station" | "browser"> {
  const text = await slipTextWithRetry(mode);

  // Ask the server by attempting enqueue — source of truth for “station on”.
  if (text) {
    const result = await enqueueCloud(mode, text);
    if (result === "queued") {
      return "station";
    }
    if (result === "disabled") {
      // Station explicitly off in Admin — only then use system print dialog.
      browserPrint(mode);
      return "browser";
    }
    // Station is on (or unknown) but queue failed — never open the Windows/Chrome dialog.
    notify("Print queue failed. Keep Start Print Agent.bat open, then try again.");
    return "station";
  }

  const stationLikelyOn = Boolean(readPrintStationConfig(fallback)?.on || fallback?.on);
  if (stationLikelyOn) {
    notify("Nothing on screen to print yet. Open the receipt, then Print again.");
    return "station";
  }

  browserPrint(mode);
  return "browser";
}

export async function enqueueTestPrint(): Promise<{ ok: boolean; error?: string }> {
  const text = [
    "TUMBLE JUNGLE",
    "TEST PRINT",
    new Date().toLocaleString("en-GB", { timeZone: "Asia/Thimphu" }),
    "If you see this, the agent and printer link work.",
  ].join("\n");
  const result = await enqueueCloud("receipt", text);
  if (result === "queued") return { ok: true };
  if (result === "disabled") return { ok: false, error: "Turn on “Send till prints…” and Save first." };
  return { ok: false, error: "Queue failed — sign in as admin/cashier and try again." };
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
