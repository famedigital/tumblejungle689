import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Rate } from "@/lib/types";

type Sql = DatabaseSync;

const globalDb = globalThis as unknown as { __tumbleDb?: Sql };

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

function dataDir(): string {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function sessionKey(): string {
  const file = path.join(dataDir(), "session.key");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return fs.readFileSync(file, "utf8");
}

function migrate(db: Sql) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS guardians (
      id INTEGER PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY,
      short_code TEXT NOT NULL UNIQUE,
      guardian_id INTEGER NOT NULL REFERENCES guardians(id),
      status TEXT NOT NULL DEFAULT 'open',
      child_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      paid_until TEXT NOT NULL,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS play_blocks (
      id INTEGER PRIMARY KEY,
      visit_id INTEGER NOT NULL REFERENCES visits(id),
      minutes INTEGER NOT NULL,
      amount_nu INTEGER NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      prior_until TEXT NOT NULL,
      extends_to TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      outlet TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES menu_categories(id),
      name TEXT NOT NULL,
      price_nu INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tab_lines (
      id INTEGER PRIMARY KEY,
      visit_id INTEGER NOT NULL REFERENCES visits(id),
      item_id INTEGER,
      name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_nu INTEGER NOT NULL,
      amount_nu INTEGER NOT NULL,
      outlet TEXT NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY,
      visit_id INTEGER NOT NULL REFERENCES visits(id),
      kind TEXT NOT NULL,
      method TEXT NOT NULL,
      amount_nu INTEGER NOT NULL,
      station TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      secret_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  addColumn(db, "visits", "table_no", "table_no TEXT NOT NULL DEFAULT ''");
  addColumn(db, "tab_lines", "fired_qty", "fired_qty INTEGER NOT NULL DEFAULT 0");
}

function addColumn(db: Sql, table: string, name: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((col) => col.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

const SAMPLE_RATES: Rate[] = [
  { minutes: 30, amountNu: 200 },
  { minutes: 60, amountNu: 350 },
  { minutes: 90, amountNu: 480 },
  { minutes: 120, amountNu: 600 },
];

function seed(db: Sql) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM settings").get() as { n: number };
  if (row.n > 0) return;
  const now = new Date().toISOString();
  const put = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  const settings: Record<string, string> = {
    venue_name: "Tumble Jungle",
    tagline: "Climb, slide, snack, and stay a while in Changjiji",
    address: "Changjiji, Thimphu",
    hours: "",
    phone: "",
    about:
      "Tumble Jungle is the indoor playground in Changjiji, Thimphu. Little ones tumble through soft play while grown-ups settle in at the cafe or restaurant. Pay for a block of play, keep one QR ticket, and add food whenever hunger hits.",
    play_blurb:
      "Pick a burst of play from 30 minutes up to 2 hours. Pay at the desk, then the children are in. The same ticket covers the whole visit, including extra time if they are not ready to leave.",
    eat_blurb:
      "The cafe is for a quick treat. The restaurant is for a proper family plate. Either counter scans the play ticket, adds the order to the tab, and you can pay there or clear everything at the cashier.",
    rates: JSON.stringify(SAMPLE_RATES),
    rates_are_samples: "1",
    menu_is_sample: "1",
    bank_payload: "",
    bank_account: "",
    payee: "Tumble Jungle",
    city: "Thimphu",
    show_credential_hint: "1",
  };
  db.exec("BEGIN");
  try {
    for (const [key, value] of Object.entries(settings)) put.run(key, value);
    const staff = db.prepare(
      "INSERT INTO staff (name, role, secret_hash, active) VALUES (?, ?, ?, 1)",
    );
    staff.run("Admin", "admin", hashSecret("tumble-local"));
    staff.run("Front desk", "frontdesk", hashSecret("1111"));
    staff.run("Cafe", "cafe", hashSecret("2222"));
    staff.run("Restaurant", "restaurant", hashSecret("3333"));
    staff.run("Cashier", "cashier", hashSecret("4444"));

    const category = db.prepare(
      "INSERT INTO menu_categories (name, outlet, sort) VALUES (?, ?, ?)",
    );
    const item = db.prepare(
      "INSERT INTO menu_items (category_id, name, price_nu, active) VALUES (?, ?, ?, 1)",
    );
    const cafeDrinks = Number(category.run("Drinks", "cafe", 1).lastInsertRowid);
    const cafeSnacks = Number(category.run("Snacks", "cafe", 2).lastInsertRowid);
    const mains = Number(category.run("Mains", "restaurant", 1).lastInsertRowid);
    const sides = Number(category.run("Sides", "restaurant", 2).lastInsertRowid);
    item.run(cafeDrinks, "Milk tea", 40);
    item.run(cafeDrinks, "Suja", 30);
    item.run(cafeDrinks, "Orange juice", 60);
    item.run(cafeSnacks, "Veg momo", 80);
    item.run(cafeSnacks, "Fries", 70);
    item.run(cafeSnacks, "Slice of cake", 90);
    item.run(mains, "Ema datshi with rice", 180);
    item.run(mains, "Chicken curry with rice", 220);
    item.run(mains, "Thukpa", 150);
    item.run(sides, "Dal", 60);
    item.run(sides, "Plain rice", 40);
    item.run(sides, "Veg curry", 90);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  void now;
}

const PREVIOUS_ABOUT =
  "Tumble Jumble is a children's playground in Changjiji, Thimphu, with a cafe and a restaurant. Families pay for a block of play, take a QR ticket, and can order food on the same visit.";

function refreshBrand(database: Sql) {
  const read = (key: string) =>
    (database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)
      ?.value;
  const name = read("venue_name");
  const about = read("about");
  if (name !== "Tumble Jumble" && about !== PREVIOUS_ABOUT) return;
  const put = database.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const next: Record<string, string> = {
    venue_name: "Tumble Jungle",
    tagline: "Climb, slide, snack, and stay a while in Changjiji",
    about:
      "Tumble Jungle is the indoor playground in Changjiji, Thimphu. Little ones tumble through soft play while grown-ups settle in at the cafe or restaurant. Pay for a block of play, keep one QR ticket, and add food whenever hunger hits.",
    play_blurb:
      "Pick a burst of play from 30 minutes up to 2 hours. Pay at the desk, then the children are in. The same ticket covers the whole visit, including extra time if they are not ready to leave.",
    eat_blurb:
      "The cafe is for a quick treat. The restaurant is for a proper family plate. Either counter scans the play ticket, adds the order to the tab, and you can pay there or clear everything at the cashier.",
  };
  if (read("payee") === "Tumble Jumble") next.payee = "Tumble Jungle";
  for (const [key, value] of Object.entries(next)) put.run(key, value);
}

export function db(): Sql {
  if (!globalDb.__tumbleDb) {
    const database = new DatabaseSync(path.join(dataDir(), "tumble.db"));
    migrate(database);
    seed(database);
    globalDb.__tumbleDb = database;
  }
  refreshBrand(globalDb.__tumbleDb);
  addColumn(globalDb.__tumbleDb, "visits", "table_no", "table_no TEXT NOT NULL DEFAULT ''");
  addColumn(globalDb.__tumbleDb, "tab_lines", "fired_qty", "fired_qty INTEGER NOT NULL DEFAULT 0");
  return globalDb.__tumbleDb;
}

export function setting(key: string): string {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? "";
}

export function putSetting(key: string, value: string) {
  db()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}
