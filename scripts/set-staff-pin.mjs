/**
 * Set one staff member's PIN by id or name.
 * Usage: node --env-file=.env.local scripts/set-staff-pin.mjs <id|name> <pin>
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import postgres from "postgres";

const who = String(process.argv[2] ?? "").trim();
const pin = String(process.argv[3] ?? "").trim();
if (!who || pin.length < 4) {
  console.error("Usage: node --env-file=.env.local scripts/set-staff-pin.mjs <id|name> <pin>");
  process.exit(1);
}

function makeSecret(secret) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifySecret(secret, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(secret, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
  fetch_types: false,
});

const rows = /^\d+$/.test(who)
  ? await sql`SELECT id, name, role FROM staff WHERE id = ${Number(who)}`
  : await sql`SELECT id, name, role FROM staff WHERE lower(name) = ${who.toLowerCase()}`;

if (!rows[0]) {
  console.error("Staff not found:", who);
  await sql.end();
  process.exit(1);
}

const hash = makeSecret(pin);
await sql`UPDATE staff SET secret_hash = ${hash} WHERE id = ${rows[0].id}`;
const check = await sql`SELECT secret_hash FROM staff WHERE id = ${rows[0].id}`;
console.log(`Updated #${rows[0].id} ${rows[0].name} (${rows[0].role}) → verify ${verifySecret(pin, check[0].secret_hash) ? "OK" : "FAIL"}`);
await sql.end();
