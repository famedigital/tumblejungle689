import { readHandle, writeHandle, type TillBook } from "@/lib/till-store";

type Writable = { write(data: string): Promise<void>; close(): Promise<void> };

type BackupHandle = {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  createWritable(): Promise<Writable>;
  getFile(): Promise<File>;
};

type PickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<BackupHandle>;
  showOpenFilePicker?: (options: {
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<BackupHandle[]>;
};

const types = [{ description: "Till backup", accept: { "application/json": [".json"] } }];

export async function chooseBackupFile(): Promise<boolean> {
  const picker = window as PickerWindow;
  if (!picker.showSaveFilePicker) return false;
  const handle = await picker.showSaveFilePicker({ suggestedName: "tumble-till-backup.json", types });
  await writeHandle(handle);
  return true;
}

export async function backupReady(): Promise<boolean> {
  return Boolean(await readHandle<BackupHandle>());
}

export async function writeBackup(book: TillBook): Promise<void> {
  const handle = await readHandle<BackupHandle>();
  if (!handle) return;
  let permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") return;
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(book));
  await writable.close();
}

export async function readBackupFile(): Promise<TillBook | null> {
  const picker = window as PickerWindow;
  if (!picker.showOpenFilePicker) return null;
  const [handle] = await picker.showOpenFilePicker({ types });
  if (!handle) return null;
  await writeHandle(handle);
  const text = await (await handle.getFile()).text();
  const parsed = JSON.parse(text) as TillBook;
  if (!parsed?.base || !Array.isArray(parsed.outbox)) return null;
  return parsed;
}
