"use client";

export type PrintMode = "receipt" | "kot" | "ticket" | "sticker" | "day";

const LS_URL = "tumble-print-agent-url";
const LS_TOKEN = "tumble-print-agent-token";

export type PrintStationConfig = {
  url: string;
  token: string;
};

export function readPrintStationConfig(fallback?: Partial<PrintStationConfig>): PrintStationConfig | null {
  let url = "";
  let token = "";
  try {
    url = (localStorage.getItem(LS_URL) || "").trim();
    token = (localStorage.getItem(LS_TOKEN) || "").trim();
  } catch {
    /* private mode */
  }
  if (!url) url = (fallback?.url || "").trim();
  if (!token) token = (fallback?.token || "").trim();
  if (!url) return null;
  return { url: url.replace(/\/$/, ""), token: token || "tumble-print" };
}

export function writePrintStationConfig(config: PrintStationConfig) {
  try {
    localStorage.setItem(LS_URL, config.url.replace(/\/$/, ""));
    localStorage.setItem(LS_TOKEN, config.token);
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

async function postToAgent(config: PrintStationConfig, mode: PrintMode, text: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${config.url}/print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Print-Token": config.token,
      },
      body: JSON.stringify({ token: config.token, mode, kind: mode, text }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return Boolean(body?.ok);
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
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
 * Prefer LAN print agent (phones → PC → thermal). Falls back to window.print().
 */
export async function thermalPrint(
  mode: PrintMode,
  fallback?: Partial<PrintStationConfig>,
): Promise<"station" | "browser"> {
  const config = readPrintStationConfig(fallback);
  const text = slipTextForPrint(mode);
  if (config && text) {
    document.body.dataset.print = mode;
    const ok = await postToAgent(config, mode, text);
    delete document.body.dataset.print;
    if (ok) return "station";
  }
  browserPrint(mode);
  return "browser";
}

export async function pingPrintStation(config: PrintStationConfig): Promise<boolean> {
  try {
    const res = await fetch(`${config.url.replace(/\/$/, "")}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return Boolean(body?.ok);
  } catch {
    return false;
  }
}
