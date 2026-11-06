/**
 * Usage: node --env-file=.env.local scripts/check-pin.mjs [pin]
 */
import { scryptSync, timingSafeEqual } from "node:crypto";
import postgres from "postgres";

const pin = String(process.argv[2] ?? "1111").trim();
const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  prepare: false,
  fetch_types: false,
});

function verifySecret(secret, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const next = scryptSync(secret, salt, 32);
    const prev = Buffer.from(hash, "hex");
    if (next.length !== prev.length) return false;
    return timingSafeEqual(next, prev);
  } catch (error) {
    console.error("verify error", error);
    return false;
  }
}

const rows = await sql`
  SELECT id, name, role, active, secret_hash
  FROM staff
  ORDER BY id
`;

for (const row of rows) {
  const parts = String(row.secret_hash || "").split(":");
  const ok = verifySecret(pin, row.secret_hash);
  console.log({
    id: row.id,
    name: row.name,
    role: row.role,
    active: row.active,
    saltLen: parts[0]?.length ?? 0,
    hashLen: parts[1]?.length ?? 0,
    matchesPin: ok,
  });
}

await sql.end();
