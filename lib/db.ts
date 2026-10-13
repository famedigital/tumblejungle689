import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const globalDb = globalThis as unknown as { __tumbleSql?: Sql };

function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(secret, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function makeSecret(secret: string): string {
  return hashSecret(secret);
}

let cachedSessionKey: string | undefined;

export async function sessionKey(): Promise<string> {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (cachedSessionKey) return cachedSessionKey;
  if (!process.env.VERCEL) {
    try {
      const dir = path.join(process.cwd(), "data");
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, "session.key");
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
      }
      cachedSessionKey = fs.readFileSync(file, "utf8").trim();
      return cachedSessionKey;
    } catch {
      // The deployment filesystem is read-only. Keep the key in the database instead.
    }
  }
  const existing = await setting("session_secret");
  if (existing) {
    cachedSessionKey = existing;
    return existing;
  }
  const created = randomBytes(32).toString("hex");
  await query().exec(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING",
    ["session_secret", created],
  );
  cachedSessionKey = (await setting("session_secret")) || created;
  return cachedSessionKey;
}

function client(): Sql {
  if (!globalDb.__tumbleSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is missing.");
    globalDb.__tumbleSql = postgres(url, {
      ssl: "require",
      max: process.env.VERCEL ? 1 : 8,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      fetch_types: false,
      types: {
        int8: {
          to: 20,
          from: [20],
          parse: (value: string) => Number(value),
          serialize: (value: number) => String(value),
        },
      },
    });
  }
  return globalDb.__tumbleSql;
}

function pg(query: string): string {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
}

export type Query = {
  one<T>(query: string, params?: unknown[]): Promise<T | undefined>;
  many<T>(query: string, params?: unknown[]): Promise<T[]>;
  exec(query: string, params?: unknown[]): Promise<void>;
  insert(query: string, params?: unknown[]): Promise<number>;
};

function bind(sql: Sql): Query {
  return {
    async one<T>(query: string, params: unknown[] = []) {
      const rows = await sql.unsafe(pg(query), params as never[]);
      return rows[0] as T | undefined;
    },
    async many<T>(query: string, params: unknown[] = []) {
      const rows = await sql.unsafe(pg(query), params as never[]);
      return rows as unknown as T[];
    },
    async exec(query: string, params: unknown[] = []) {
      await sql.unsafe(pg(query), params as never[]);
    },
    async insert(query: string, params: unknown[] = []) {
      const returning = /\breturning\b/i.test(query) ? query : `${query} returning id`;
      const rows = await sql.unsafe(pg(returning), params as never[]);
      return Number((rows[0] as { id?: number } | undefined)?.id ?? 0);
    },
  };
}

function closed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = error instanceof Error ? error.message : "";
  return (
    code === "CONNECTION_CLOSED" ||
    code === "CONNECTION_ENDED" ||
    code === "CONNECTION_DESTROYED" ||
    code === "CONNECT_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT" ||
    /connection closed|connection ended|connect timeout|econnreset/i.test(message)
  );
}

async function dropClient() {
  const current = globalDb.__tumbleSql;
  globalDb.__tumbleSql = undefined;
  if (current) await current.end({ timeout: 1 }).catch(() => undefined);
}

async function withSql<T>(run: (sql: Sql) => Promise<T>): Promise<T> {
  try {
    return await run(client());
  } catch (error) {
    if (!closed(error)) throw error;
    await dropClient();
    return run(client());
  }
}

export function query(): Query {
  return {
    one(query, params) {
      return withSql((sql) => bind(sql).one(query, params));
    },
    many(query, params) {
      return withSql((sql) => bind(sql).many(query, params));
    },
    exec(query, params) {
      return withSql((sql) => bind(sql).exec(query, params));
    },
    insert(query, params) {
      return withSql((sql) => bind(sql).insert(query, params));
    },
  };
}

export async function tx<T>(fn: (query: Query) => Promise<T>): Promise<T> {
  return withSql(async (sql) => {
    const result = await sql.begin(async (trx) => fn(bind(trx as unknown as Sql)));
    return result as T;
  });
}

export async function setting(key: string): Promise<string> {
  const row = await query().one<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? "";
}

export async function putSetting(key: string, value: string) {
  await query().exec(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}

let eventsReady = false;

export async function ensureTillEvents(): Promise<void> {
  if (eventsReady) return;
  await query().exec(
    `CREATE TABLE IF NOT EXISTS till_events (
      id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      visit_id bigint,
      code text NOT NULL DEFAULT '',
      phone text NOT NULL DEFAULT '',
      staff_id bigint,
      staff_name text NOT NULL DEFAULT '',
      kind text NOT NULL,
      amount_nu integer NOT NULL DEFAULT 0,
      note text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL
    )`,
  );
  eventsReady = true;
}

let syncReady = false;

export async function ensureTillSync(): Promise<void> {
  if (syncReady) return;
  await query().exec("ALTER TABLE visits ADD COLUMN IF NOT EXISTS client_key text");
  await query().exec("ALTER TABLE tab_lines ADD COLUMN IF NOT EXISTS client_key text");
  await query().exec(
    `CREATE TABLE IF NOT EXISTS till_ops (
      client_op_id text PRIMARY KEY,
      applied_at timestamptz NOT NULL,
      visit_id bigint,
      result text NOT NULL DEFAULT ''
    )`,
  );
  await query().exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS visits_client_key_uidx ON visits (client_key) WHERE client_key IS NOT NULL",
  );
  syncReady = true;
}

let journalReady = false;
let journalTask: Promise<boolean> | null = null;

/** Adds the journal column when the database allows it. A refusal must not stop the app. */
export function ensureJournalColumn(): Promise<boolean> {
  if (journalReady) return Promise.resolve(true);
  if (!journalTask) {
    journalTask = (async () => {
      try {
        await query().exec("ALTER TABLE payments ADD COLUMN IF NOT EXISTS journal_ref text");
        await query().exec("ALTER TABLE payments ADD COLUMN IF NOT EXISTS pay_bank text");
        journalReady = true;
        return true;
      } catch {
        return false;
      } finally {
        if (!journalReady) journalTask = null;
      }
    })();
  }
  return journalTask;
}
