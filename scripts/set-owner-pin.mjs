/**
 * Sets every active admin staff secret to the given PIN (default 1111).
 * Usage: node --env-file=.env.local scripts/set-owner-pin.mjs [pin]
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import postgres from "postgres";

const pin = String(process.argv[2] ?? "1111").trim();
if (pin.length < 4) {
  console.error("PIN must be at least 4 characters.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
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

const sql = postgres(url, {
  ssl: "require",
  max: 1,
  prepare: false,
  fetch_types: false,
});

const admins = await sql`
  SELECT id, name, role, active, secret_hash
  FROM staff
  WHERE role = 'admin' AND active = 1
  ORDER BY id
`;

if (!admins.length) {
  console.error("No active admin staff found.");
  await sql.end();
  process.exit(1);
}

const hash = makeSecret(pin);
for (const row of admins) {
  await sql`UPDATE staff SET secret_hash = ${hash} WHERE id = ${row.id}`;
  console.log(`Updated admin #${row.id} (${row.name})`);
}

const check = await sql`
  SELECT id, name, secret_hash
  FROM staff
  WHERE role = 'admin' AND active = 1
`;
for (const row of check) {
  const ok = verifySecret(pin, row.secret_hash);
  console.log(`Verify ${row.name}: ${ok ? "OK" : "FAIL"}`);
}

await sql.end();
console.log(`Owner PIN is now ${pin}`);
