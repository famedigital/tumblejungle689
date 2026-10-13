import type { MenuItem, Rate, RecentTxn, VisitView } from "@/lib/types";
import type { TillOp } from "@/lib/till-op";

export type TillBase = {
  visits: VisitView[];
  menu: MenuItem[];
  recent: RecentTxn[];
  todayNu: number;
  playNu: number;
  foodNu: number;
  kotNu: number;
  botNu: number;
  nextReceipt: number;
  generation: number;
  venueName: string;
  address: string;
  rates: Rate[];
  extraPerMinNu: number;
  bankAccount: string;
  bankPayload: string;
  payee: string;
  city: string;
  journalScan: boolean;
  receiptNote: string;
  receiptThanks: string;
  receiptRules: string;
  scOn: boolean;
  scPercent: number;
  gstOn: boolean;
  gstPercent: number;
  savedAt: string;
};

export type TillBook = {
  base: TillBase;
  outbox: TillOp[];
};

export type TillSnapshot = TillBase & { focus: import("@/lib/types").VisitView | null };

const DB = "tumble-till";
const STORE = "kv";

export function emptyBase(): TillBase {
  return {
    visits: [],
    menu: [],
    recent: [],
    todayNu: 0,
    playNu: 0,
    foodNu: 0,
    kotNu: 0,
    botNu: 0,
    nextReceipt: 1,
    generation: 0,
    venueName: "Tumble Jungle",
    address: "",
    rates: [],
    extraPerMinNu: 0,
    bankAccount: "",
    bankPayload: "",
    payee: "",
    city: "",
    journalScan: false,
    receiptNote: "",
    receiptThanks: "",
    receiptRules: "",
    scOn: false,
    scPercent: 10,
    gstOn: false,
    gstPercent: 5,
    savedAt: "",
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readBook(): Promise<TillBook | null> {
  const db = await openDb();
  const book = await requestDone(db.transaction(STORE).objectStore(STORE).get("book"));
  db.close();
  if (!book || typeof book !== "object") return null;
  const stored = book as TillBook;
  if (!stored.base || !Array.isArray(stored.outbox)) return null;
  return stored;
}

export async function writeBook(book: TillBook): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(book, "book");
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function readHandle<T>(): Promise<T | null> {
  const db = await openDb();
  const handle = await requestDone(db.transaction(STORE).objectStore(STORE).get("backup"));
  db.close();
  return (handle as T | undefined) ?? null;
}

export async function writeHandle(handle: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(handle, "backup");
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
