import { ensurePrintSchema, putSetting, query, tx } from "@/lib/db";
import { getSettings } from "@/lib/domain";

export type PrintJob = {
  id: number;
  kind: string;
  body: string;
  status: string;
  createdAt: string;
};

export async function enqueuePrintJob(kind: string, body: string): Promise<PrintJob> {
  await ensurePrintSchema();
  const text = body.trim();
  if (!text) throw new Error("Nothing to print.");
  const created = new Date().toISOString();
  const id = await query().insert(
    `INSERT INTO print_jobs (kind, body, status, created_at) VALUES (?, ?, 'queued', ?)`,
    [kind.slice(0, 32) || "slip", text.slice(0, 20_000), created],
  );
  return { id, kind, body: text, status: "queued", createdAt: created };
}

export async function claimPrintJob(token: string): Promise<PrintJob | null> {
  await ensurePrintSchema();
  const settings = await getSettings();
  if (!tokenOk(token, settings.printAgentToken)) throw new Error("Bad print token.");
  await putSetting("print_agent_seen", new Date().toISOString());

  return tx(async (database) => {
    const row = await database.one<{
      id: number;
      kind: string;
      body: string;
      status: string;
      created_at: string;
    }>(
      `WITH next AS (
         SELECT id FROM print_jobs
         WHERE status = 'queued'
         ORDER BY id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE print_jobs AS j
       SET status = 'printing', claimed_at = NOW()
       FROM next
       WHERE j.id = next.id
       RETURNING j.id, j.kind, j.body, j.status, j.created_at`,
    );
    if (!row) return null;
    return {
      id: row.id,
      kind: row.kind,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

export async function completePrintJob(token: string, id: number, ok = true): Promise<void> {
  await ensurePrintSchema();
  const settings = await getSettings();
  if (!tokenOk(token, settings.printAgentToken)) throw new Error("Bad print token.");
  await query().exec(
    `UPDATE print_jobs SET status = ?, done_at = NOW() WHERE id = ? AND status = 'printing'`,
    [ok ? "done" : "failed", id],
  );
  await putSetting("print_agent_seen", new Date().toISOString());
}

export async function printAgentStatus(): Promise<{
  enabled: boolean;
  tokenSet: boolean;
  lastSeen: string;
  queued: number;
}> {
  await ensurePrintSchema();
  const settings = await getSettings();
  const seen = await query().one<{ value: string }>("SELECT value FROM settings WHERE key = 'print_agent_seen'");
  const queued = Number(
    (await query().one<{ n: number }>("SELECT COUNT(*)::int AS n FROM print_jobs WHERE status = 'queued'"))?.n ?? 0,
  );
  return {
    enabled: settings.printAgentOn,
    tokenSet: Boolean(settings.printAgentToken),
    lastSeen: seen?.value || "",
    queued,
  };
}

function tokenOk(got: string, expected: string) {
  const a = got.trim();
  const b = (expected || "tumble-print").trim();
  return Boolean(a) && a === b;
}
