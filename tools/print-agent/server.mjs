/**
 * Tumble Jungle print agent — run on the PC connected to the receipt printer.
 * Pulls jobs from the cloud site (fixes HTTPS till → LAN blocked by browsers).
 *
 *   cd tools\print-agent
 *   copy .env.example .env
 *   notepad .env
 *   npm start
 */
import { connect } from "node:net";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

loadEnv();

const CLOUD_URL = String(process.env.CLOUD_URL || "https://tumblejungle689.vercel.app").replace(/\/$/, "");
const TOKEN = String(process.env.TOKEN || "tumble-print").trim();
const PRINTER_HOST = String(process.env.PRINTER_HOST || "").trim();
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);
const PRINTER_NAME = String(process.env.PRINTER_NAME || "").trim();
const POLL_MS = Math.max(800, Number(process.env.POLL_MS || 1500));

const ESC = {
  init: Buffer.from([0x1b, 0x40]),
  left: Buffer.from([0x1b, 0x61, 0x00]),
  boldOn: Buffer.from([0x1b, 0x45, 0x01]),
  boldOff: Buffer.from([0x1b, 0x45, 0x00]),
  cut: Buffer.from([0x1d, 0x56, 0x00]),
  feed: Buffer.from("\n\n\n"),
};

function loadEnv() {
  const path = new URL("./.env", import.meta.url);
  try {
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* optional .env */
  }
}

function toEscPos(text) {
  const clean = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, "  ")
    .trimEnd();
  const lines = clean.split("\n").map((line) => line.slice(0, 48));
  return Buffer.concat([
    ESC.init,
    ESC.left,
    ESC.boldOn,
    Buffer.from(lines.join("\n") + "\n", "utf8"),
    ESC.boldOff,
    ESC.feed,
    ESC.cut,
  ]);
}

function sendRaw(buf) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: PRINTER_HOST, port: PRINTER_PORT }, () => {
      socket.write(buf, (err) => {
        if (err) {
          socket.destroy();
          reject(err);
          return;
        }
        socket.end();
        resolve();
      });
    });
    socket.setTimeout(8000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Printer timed out — check PRINTER_HOST / cable."));
    });
    socket.on("error", reject);
  });
}

async function sendWindows(text) {
  if (!PRINTER_NAME) {
    throw new Error("Set PRINTER_HOST (network) or PRINTER_NAME (Windows USB printer).");
  }
  const dir = await mkdtemp(join(tmpdir(), "tumble-print-"));
  const file = join(dir, "slip.txt");
  await writeFile(file, text.replace(/\r\n/g, "\n") + "\n\n\n", "utf8");
  const ps = `
    $ErrorActionPreference = 'Stop'
    Get-Content -LiteralPath '${file.replace(/'/g, "''")}' -Raw | Out-Printer -Name '${PRINTER_NAME.replace(/'/g, "''")}'
  `;
  await new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", ps],
      { windowsHide: true, timeout: 20000 },
      (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message || "Windows print failed"));
        else resolve();
      },
    );
  });
  await unlink(file).catch(() => undefined);
}

async function printJob(text) {
  const body = String(text || "").trim();
  if (!body) throw new Error("Nothing to print.");
  if (PRINTER_HOST) {
    await sendRaw(toEscPos(body));
    return;
  }
  await sendWindows(body);
}

async function claim() {
  const res = await fetch(`${CLOUD_URL}/api/print/claim`, {
    method: "GET",
    headers: { "X-Print-Token": TOKEN },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Claim HTTP ${res.status}`);
  return data.job || null;
}

async function complete(id, ok) {
  await fetch(`${CLOUD_URL}/api/print/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Print-Token": TOKEN },
    body: JSON.stringify({ token: TOKEN, id, ok }),
  });
}

async function loop() {
  try {
    const job = await claim();
    if (job?.id && job.body) {
      console.log(`Printing job #${job.id} (${job.kind || "slip"})…`);
      try {
        await printJob(job.body);
        await complete(job.id, true);
        console.log(`Done #${job.id}`);
      } catch (err) {
        console.error(`Print failed #${job.id}:`, err instanceof Error ? err.message : err);
        await complete(job.id, false).catch(() => undefined);
      }
    }
  } catch (err) {
    console.error("Poll error:", err instanceof Error ? err.message : err);
  } finally {
    setTimeout(loop, POLL_MS);
  }
}

console.log(`Tumble print agent`);
console.log(`Cloud: ${CLOUD_URL}`);
console.log(`Token: ${TOKEN}`);
console.log(
  `Printer: ${PRINTER_HOST ? `${PRINTER_HOST}:${PRINTER_PORT}` : PRINTER_NAME || "(set PRINTER_HOST or PRINTER_NAME)"}`,
);
console.log(`Polling every ${POLL_MS}ms — leave this window open.`);
loop();
