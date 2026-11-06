/**
 * Tumble Jungle v2 Silent Print Daemon
 * Run on the counter PC connected to the thermal receipt printer (USB or LAN).
 *
 * Listens to Supabase Realtime WebSockets (<50ms latency) for print_job events.
 * Prints silently to Windows USB printer or raw LAN ESC/POS printer.
 *
 * Usage:
 *   node scripts/v2-print-daemon.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { connect } from "node:net";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

// Load .env or .env.local
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://fxnvsrnruosxndvnteuw.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const PRINTER_NAME = process.env.PRINTER_NAME || "POS-80"; // Default Windows thermal printer name
const PRINTER_HOST = process.env.PRINTER_HOST || "";       // Optional LAN IP e.g. 192.168.1.200
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);

if (!SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_ANON_KEY in environment or .env.local");
  process.exit(1);
}

const ESC = {
  init: Buffer.from([0x1b, 0x40]),
  left: Buffer.from([0x1b, 0x61, 0x00]),
  boldOn: Buffer.from([0x1b, 0x45, 0x01]),
  boldOff: Buffer.from([0x1b, 0x45, 0x00]),
  cut: Buffer.from([0x1d, 0x56, 0x00]),
  feed: Buffer.from("\n\n\n"),
};

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      if (!existsSync(file)) continue;
      const content = readFileSync(file, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
    } catch {}
  }
}

function toEscPos(text) {
  const clean = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trimEnd();
  return Buffer.concat([
    ESC.init,
    ESC.left,
    Buffer.from(clean + "\n", "utf8"),
    ESC.feed,
    ESC.cut,
  ]);
}

function sendRawLan(buf) {
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
    socket.setTimeout(6000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Printer LAN timeout"));
    });
    socket.on("error", reject);
  });
}

async function sendWindowsSpooler(text) {
  const dir = await mkdtemp(join(tmpdir(), "tj-print-"));
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
      { windowsHide: true, timeout: 15000 },
      (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message || "Windows print failed"));
        else resolve();
      }
    );
  });

  await unlink(file).catch(() => undefined);
}

async function printSlip(job) {
  console.log(`\n🖨️  [PRINT TRIGGERED] [${job.kind.toUpperCase()}] "${job.title}"`);
  console.log(`   Staff : ${job.staffName || "Staff"} | Device: ${job.deviceLabel || "Mobile"}`);
  console.log(`   Time  : ${new Date().toLocaleTimeString()}`);

  try {
    if (PRINTER_HOST) {
      await sendRawLan(toEscPos(job.body));
    } else {
      await sendWindowsSpooler(job.body);
    }
    console.log(`   ✅ Printed successfully to ${PRINTER_HOST ? `${PRINTER_HOST}:${PRINTER_PORT}` : PRINTER_NAME}`);
  } catch (err) {
    console.error(`   ❌ Print error:`, err instanceof Error ? err.message : err);
    console.log("   (Raw Slip Content):\n" + job.body);
  }
}

// Connect Supabase Realtime WebSocket
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const channel = supabase.channel("tumble-v2-live", {
  config: { broadcast: { self: true } },
});

channel
  .on("broadcast", { event: "print_job" }, ({ payload }) => {
    if (payload && payload.body) {
      printSlip(payload);
    }
  })
  .subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log("\n=======================================================");
      console.log("🚀 TUMBLE JUNGLE V2 SILENT PRINT DAEMON ACTIVE");
      console.log("=======================================================");
      console.log(`📡 WebSocket Channel : tumble-v2-live`);
      console.log(`⚡ Supabase URL      : ${SUPABASE_URL}`);
      console.log(`🖨️  Printer Target    : ${PRINTER_HOST ? `LAN (${PRINTER_HOST}:${PRINTER_PORT})` : `Windows (${PRINTER_NAME})`}`);
      console.log("👂 Listening for remote prints from all mobile staff phones...");
      console.log("   (Leave this console window open at the counter)\n");
    } else {
      console.log(`[WebSocket] Status changed: ${status}`);
    }
  });

// Keep process running
process.stdin.resume();
