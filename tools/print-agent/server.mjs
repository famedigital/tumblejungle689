/**
 * Tumble Jungle print agent — run on the PC connected to the receipt printer.
 * Phones on the same WiFi POST /print; this box sends ESC/POS (or Windows spool).
 *
 *   cd tools/print-agent
 *   copy .env.example .env   # edit TOKEN + printer
 *   npm start
 */
import { createServer } from "node:http";
import { connect } from "node:net";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

loadEnv();

const PORT = Number(process.env.PORT || 7910);
const TOKEN = String(process.env.TOKEN || "tumble-print").trim();
const PRINTER_HOST = String(process.env.PRINTER_HOST || "").trim();
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);
const PRINTER_NAME = String(process.env.PRINTER_NAME || "").trim();

const ESC = {
  init: Buffer.from([0x1b, 0x40]),
  center: Buffer.from([0x1b, 0x61, 0x01]),
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

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Print-Token");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function tokenOk(req, body) {
  const header =
    req.headers["x-print-token"] ||
    (String(req.headers.authorization || "").startsWith("Bearer ")
      ? String(req.headers.authorization).slice(7)
      : "");
  const fromBody = body && typeof body.token === "string" ? body.token : "";
  const got = String(header || fromBody || "").trim();
  return got && got === TOKEN;
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
    return { mode: "network", host: PRINTER_HOST, port: PRINTER_PORT };
  }
  await sendWindows(body);
  return { mode: "windows", printer: PRINTER_NAME };
}

function json(res, status, payload) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

const server = createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    json(res, 200, {
      ok: true,
      service: "tumble-print-agent",
      port: PORT,
      target: PRINTER_HOST
        ? `network://${PRINTER_HOST}:${PRINTER_PORT}`
        : PRINTER_NAME
          ? `windows://${PRINTER_NAME}`
          : "unconfigured",
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/print") {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      if (!tokenOk(req, body)) {
        json(res, 401, { ok: false, error: "Bad print token." });
        return;
      }
      const text = typeof body.text === "string" ? body.text : "";
      const result = await printJob(text);
      json(res, 200, { ok: true, kind: body.kind || body.mode || "slip", ...result });
    } catch (err) {
      json(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : "Print failed.",
      });
    }
    return;
  }

  json(res, 404, { ok: false, error: "Not found." });
});

server.listen(PORT, "0.0.0.0", () => {
  const target = PRINTER_HOST
    ? `${PRINTER_HOST}:${PRINTER_PORT}`
    : PRINTER_NAME || "(set PRINTER_HOST or PRINTER_NAME)";
  console.log(`Tumble print agent on http://0.0.0.0:${PORT}`);
  console.log(`Printer target: ${target}`);
  console.log(`Token: ${TOKEN}`);
  console.log(`Health: http://127.0.0.1:${PORT}/health`);
});
