import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const sql = postgres(url, {
  ssl: "require",
  max: 1,
  prepare: false,
  fetch_types: false,
});

async function resetAll() {
  console.log("=== Beginning Complete Reset of Orders, Playtime & Transactions ===");

  await sql.begin(async (tx) => {
    // 1. Delete all order lines (F&B orders)
    const delLines = await tx`DELETE FROM tab_lines RETURNING id`;
    console.log(`Deleted ${delLines.length} tab_lines (orders)`);

    // 2. Delete all play blocks (playtime sessions)
    const delBlocks = await tx`DELETE FROM play_blocks RETURNING id`;
    console.log(`Deleted ${delBlocks.length} play_blocks (playtime)`);

    // 3. Delete all payments
    const delPayments = await tx`DELETE FROM payments RETURNING id`;
    console.log(`Deleted ${delPayments.length} payments`);

    // 4. Delete till audit events & offline sync ops
    const delEvents = await tx`DELETE FROM till_events RETURNING id`;
    console.log(`Deleted ${delEvents.length} till_events`);

    const delOps = await tx`DELETE FROM till_ops RETURNING client_op_id`;
    console.log(`Deleted ${delOps.length} till_ops`);

    // 5. Delete all visits
    const delVisits = await tx`DELETE FROM visits RETURNING id`;
    console.log(`Deleted ${delVisits.length} visits`);

    // 6. Delete all guardians
    const delGuardians = await tx`DELETE FROM guardians RETURNING id`;
    console.log(`Deleted ${delGuardians.length} guardians`);

    // 7. Reset next_receipt sequence to 1 in settings
    await tx`
      INSERT INTO settings (key, value) VALUES ('next_receipt', '1')
      ON CONFLICT (key) DO UPDATE SET value = '1'
    `;
    console.log("Reset next_receipt counter in settings to 1");
  });

  console.log("\n=== Verifying Row Counts Post-Reset ===");
  const checks = ["visits", "play_blocks", "tab_lines", "payments", "till_events", "till_ops", "guardians"];
  for (const table of checks) {
    const [row] = await sql.unsafe(`SELECT COUNT(*) as c FROM ${table}`);
    console.log(`${table}: ${row.c} rows`);
  }

  const [receipt] = await sql`SELECT value FROM settings WHERE key = 'next_receipt'`;
  console.log(`next_receipt setting: ${receipt?.value}`);

  const [menuCount] = await sql`SELECT COUNT(*) as c FROM menu_items`;
  const [staffCount] = await sql`SELECT COUNT(*) as c FROM staff`;
  console.log(`menu_items preserved: ${menuCount.c}`);
  console.log(`staff preserved: ${staffCount.c}`);

  await sql.end();
  console.log("\n=== RESET COMPLETE: All orders, playtime, and visits are at 0 ===");
}

resetAll().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
