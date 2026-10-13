"use server";

import { redirect } from "next/navigation";
import { clearSession, findStaffBySecret, getSession, requireArea, setSession } from "@/lib/auth";
import {
  addCategory,
  addMenuItem,
  counterCategory,
  listMenu,
  addPlayBlock,
  addStaff,
  addTabItem,
  addWalkInItem,
  changeLineQty,
  createVisit,
  payOutlet,
  payPlayDue,
  removeLatestUnpaidBlock,
  removeTabLine,
  addChildren,
  cancelHold,
  leaveOnTime,
  voidLineTo,
  voidVisit,
  waiveOvertime,
  saveBank,
  saveCharges,
  saveExtraPerMin,
  saveRates,
  saveReceipt,
  saveKot,
  saveVenue,
  saveJournalScan,
  setStaffActive,
  setStaffSecret,
  settleVisit,
  updateMenuItem,
} from "@/lib/domain";
import { bankFromJournal, knownBank } from "@/lib/pay-banks";
import { can, type Outlet, type PayMethod, type Role } from "@/lib/types";

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function finish(formData: FormData, fallback: string, ok: string, desk?: string): never {
  const back = text(formData, "back");
  if (back === "/admin/products" || back === "/admin/bank" || back === "/admin/receipt") {
    const params = new URLSearchParams({ ok });
    const id = desk || text(formData, "desk");
    if (id) params.set("desk", id);
    redirect(`${back}?${params.toString()}`);
  }
  redirect(`${fallback}?ok=${encodeURIComponent(ok)}`);
}

function bounce(path: string, error: unknown, code?: string): never {
  const params = new URLSearchParams();
  if (code) params.set("q", code);
  params.set("error", messageOf(error));
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}${params.toString()}`);
}

async function run(path: string, code: string | undefined, fn: () => Promise<void> | void) {
  try {
    await fn();
  } catch (error) {
    if (isRedirect(error)) throw error;
    bounce(path, error, code);
  }
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function methodOf(formData: FormData): PayMethod {
  return text(formData, "method") === "bank_qr" ? "bank_qr" : "cash";
}

function payOf(formData: FormData): PayMethod | { cashNu: number; bankNu: number } {
  if (text(formData, "method") === "split") {
    return {
      cashNu: Math.round(Number(formData.get("cashNu")) || 0),
      bankNu: Math.round(Number(formData.get("bankNu")) || 0),
    };
  }
  return methodOf(formData);
}

function journalOf(formData: FormData): string {
  return text(formData, "journal").trim().slice(0, 40);
}

function payBankOf(formData: FormData, journal: string): string {
  return knownBank(text(formData, "payBank")) || bankFromJournal(journal);
}

function visitId(formData: FormData): number {
  return Number(formData.get("visitId"));
}

function areaFor(back: string): "desk" | "cafe" | "restaurant" | "cashier" {
  if (back.startsWith("/desk")) return "desk";
  if (back.startsWith("/counter/cafe")) return "cafe";
  if (back.startsWith("/counter/restaurant")) return "restaurant";
  return "cashier";
}

function outletOf(value: string): Outlet {
  if (value !== "cafe" && value !== "restaurant") throw new Error("Unknown counter.");
  return value;
}

const ROLES: Role[] = ["admin", "frontdesk", "cafe", "restaurant", "cashier"];

export async function loginAction(formData: FormData) {
  const staff = await findStaffBySecret(text(formData, "secret"));
  if (!staff) redirect("/login?error=That%20password%20or%20PIN%20was%20not%20recognised.");
  await setSession({ staffId: staff.id, name: staff.name, role: staff.role });
  redirect(
    staff.role === "admin"
      ? "/admin"
      : staff.role === "frontdesk"
        ? "/desk"
        : staff.role === "cafe"
          ? "/counter/cafe"
          : staff.role === "restaurant"
            ? "/counter/restaurant"
            : "/cashier",
  );
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function checkInAction(formData: FormData) {
  const back = text(formData, "back") || "/desk";
  await run(back, undefined, async () => {
    await requireArea(back.startsWith("/cashier") ? "cashier" : "desk");
    const visit = await createVisit({
      phone: text(formData, "phone"),
      name: text(formData, "name"),
      childCount: Number(formData.get("childCount") || 1),
      minutes: Number(formData.get("minutes")),
      method: methodOf(formData),
      station: back.startsWith("/cashier") ? "cashier" : "desk",
      journal: journalOf(formData),
      payBank: payBankOf(formData, journalOf(formData)),
      ...(text(formData, "method") === "split"
        ? { cashNu: Math.round(Number(formData.get("cashNu"))), bankNu: Math.round(Number(formData.get("bankNu"))) }
        : {}),
    });
    redirect(back.startsWith("/cashier") ? `/cashier?q=${visit.code}&print=pack` : `/stickers/${visit.code}`);
  });
}

export async function addPlayAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/desk") ? "desk" : "cashier");
    const visit = await addPlayBlock(visitId(formData), Number(formData.get("minutes")));
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function removeLineAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(areaFor(back));
    const visit = await removeTabLine(Number(formData.get("lineId")));
    redirect(`${back}?q=${visit.code}`);
  });
}

async function requireManager(formData: FormData) {
  const staff = await findStaffBySecret(text(formData, "secret"));
  if (!staff || staff.role !== "admin") throw new Error("Manager PIN was not recognised.");
  return staff;
}

export async function leaveHoldAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    const session = await requireArea(areaFor(back));
    await leaveOnTime(visitId(formData), { id: session.staffId, name: session.name });
    redirect(`${back}?ok=${encodeURIComponent("Left on time")}`);
  });
}

export async function cancelHoldAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    const session = await requireArea(areaFor(back));
    await cancelHold(visitId(formData), { id: session.staffId, name: session.name });
    redirect(`${back}?ok=${encodeURIComponent("Empty bill removed")}`);
  });
}

export async function releaseHoldAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(areaFor(back));
    const manager = await requireManager(formData);
    const actor = { id: manager.id, name: manager.name };
    const choice = text(formData, "choice");
    if (choice === "waive") await waiveOvertime(visitId(formData), actor);
    else await voidVisit(visitId(formData), actor);
    redirect(`${back}?ok=${encodeURIComponent(choice === "waive" ? "Overtime made free" : "Bill voided")}`);
  });
}

export async function addChildrenAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(areaFor(back));
    const visit = await addChildren(visitId(formData), Number(formData.get("childCount") || 1));
    redirect(`${back}?q=${visit.code}&print=pack`);
  });
}

export async function voidLineAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(areaFor(back));
    const manager = await requireManager(formData);
    const visit = await voidLineTo(Number(formData.get("lineId")), Number(formData.get("nextQty")), {
      id: manager.id,
      name: manager.name,
    });
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function removePlayAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/desk") ? "desk" : "cashier");
    const visit = await removeLatestUnpaidBlock(visitId(formData));
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function saveKotAction(visitId: number, tableNo: string, lineIds: number[]) {
  await requireArea("cashier");
  await saveKot(visitId, tableNo, lineIds);
}

export async function addItemAction(formData: FormData) {
  const outlet = outletOf(text(formData, "outlet"));
  const back = text(formData, "back") || `/counter/${outlet}`;
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/cashier") ? "cashier" : outlet);
    const visitIdValue = Number(formData.get("visitId"));
    const visit = visitIdValue
      ? await addTabItem(visitIdValue, Number(formData.get("itemId")), outlet)
      : await addWalkInItem(Number(formData.get("itemId")), outlet);
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function qtyAction(formData: FormData) {
  const outlet = outletOf(text(formData, "outlet"));
  const back = text(formData, "back") || `/counter/${outlet}`;
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/cashier") ? "cashier" : outlet);
    const visit = await changeLineQty(Number(formData.get("lineId")), Number(formData.get("delta")));
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function payOutletAction(formData: FormData) {
  const outlet = outletOf(text(formData, "outlet"));
  const back = `/counter/${outlet}`;
  await run(back, text(formData, "code"), async () => {
    await requireArea(outlet);
    const journal = journalOf(formData);
    const visit = await payOutlet(visitId(formData), outlet, payOf(formData), journal, payBankOf(formData, journal));
    redirect(`${back}?q=${visit.code}&ok=Payment%20taken`);
  });
}

export async function payPlayAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/desk") ? "desk" : "cashier");
    const journal = journalOf(formData);
    const visit = await payPlayDue(
      visitId(formData),
      payOf(formData),
      back.startsWith("/desk") ? "desk" : "cashier",
      journal,
      payBankOf(formData, journal),
    );
    redirect(`${back}?q=${visit.code}&ok=Playtime%20paid`);
  });
}

export async function settleAction(formData: FormData) {
  await run("/cashier", text(formData, "code"), async () => {
    await requireArea("cashier");
    const journal = journalOf(formData);
    const closed = await settleVisit(visitId(formData), payOf(formData), journal, payBankOf(formData, journal));
    redirect(`/receipt/${closed.code}`);
  });
}

export async function saveVenueAction(formData: FormData) {
  await run("/admin?section=page", undefined, async () => {
    await requireArea("admin");
    await saveVenue({
      venueName: text(formData, "venueName"),
      tagline: text(formData, "tagline"),
      address: text(formData, "address"),
      hours: text(formData, "hours"),
      phone: text(formData, "phone"),
      about: text(formData, "about"),
      playBlurb: text(formData, "playBlurb"),
      eatBlurb: text(formData, "eatBlurb"),
    });
    redirect("/admin?section=page&ok=Venue%20page%20saved");
  });
}

export async function openBackOfficeAction(formData: FormData) {
  const owner = await findStaffBySecret(text(formData, "secret"));
  if (!owner || owner.role !== "admin") redirect("/cashier?error=Owner%20PIN%20was%20not%20recognised.");
  await setSession({ staffId: owner.id, name: owner.name, role: owner.role });
  redirect("/admin");
}

export async function addCounterDish(input: { name: string; priceNu: number; outlet: Outlet; secret: string }) {
  const session = await getSession();
  if (!session || !can(session.role, "cashier")) throw new Error("Sign in again.");
  if (session.role !== "admin") {
    const owner = await findStaffBySecret(input.secret);
    if (!owner || owner.role !== "admin") throw new Error("Owner PIN was not recognised.");
  }
  const categoryId = await counterCategory(input.outlet);
  const id = await addMenuItem({ categoryId, name: input.name, priceNu: input.priceNu });
  const item = (await listMenu(input.outlet, true)).find((row) => row.id === id);
  if (!item) throw new Error("The dish was not saved.");
  return item;
}

export async function saveExtraPerMinAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/products" ? "/admin/products" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    await saveExtraPerMin(Number(formData.get("amountNu") ?? 0));
    finish(formData, "/admin", "Extra time saved", "extra");
  });
}

export async function saveRatesAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/products" ? "/admin/products" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    const rates = JSON.parse(text(formData, "rates")) as { minutes: number; amountNu: number }[];
    await saveRates(rates);
    finish(formData, "/admin", "Play rates saved", text(formData, "desk"));
  });
}

export async function saveBankAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/bank" ? "/admin/bank" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    await saveBank({
      payload: text(formData, "payload"),
      account: text(formData, "account"),
      payee: text(formData, "payee"),
      city: text(formData, "city"),
    });
    finish(formData, "/admin", "Bank details saved");
  });
}

export async function saveJournalScanAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/bank" ? "/admin/bank" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    await saveJournalScan(text(formData, "journalScan") === "1");
    finish(formData, "/admin", "Journal scan saved");
  });
}

export async function saveChargesAction(formData: FormData) {
  await run("/admin?section=charges", undefined, async () => {
    await requireArea("admin");
    await saveCharges({
      scOn: text(formData, "scOn") === "1",
      scPercent: Number(formData.get("scPercent") ?? 0),
      gstOn: text(formData, "gstOn") === "1",
      gstPercent: Number(formData.get("gstPercent") ?? 0),
    });
    redirect("/admin?section=charges&ok=Service%20charge%20and%20GST%20saved");
  });
}

export async function saveReceiptAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/receipt" ? "/admin/receipt" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    await saveReceipt({
      note: text(formData, "note"),
      thanks: text(formData, "thanks"),
      rules: text(formData, "rules"),
    });
    finish(formData, "/admin", "Receipt saved");
  });
}

export async function addCategoryAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/products" ? "/admin/products" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    await addCategory(text(formData, "name"), outletOf(text(formData, "outlet")));
    finish(formData, "/admin", "Category added");
  });
}

export async function addMenuItemAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/products" ? "/admin/products" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    const id = await addMenuItem({
      categoryId: Number(formData.get("categoryId")),
      name: text(formData, "name"),
      priceNu: Number(formData.get("priceNu")),
    });
    finish(formData, "/admin", "Item added", `item-${id}`);
  });
}

export async function updateMenuItemAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/products" ? "/admin/products" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    const id = Number(formData.get("id"));
    await updateMenuItem(id, {
      name: text(formData, "name"),
      priceNu: Number(formData.get("priceNu")),
      active: formData.get("active") === "on",
      categoryId: Number(formData.get("categoryId")) || undefined,
    });
    finish(formData, "/admin", "Menu updated", `item-${id}`);
  });
}

export async function addStaffAction(formData: FormData) {
  await run("/admin?section=staff", undefined, async () => {
    await requireArea("admin");
    const role = text(formData, "role") as Role;
    if (!ROLES.includes(role)) throw new Error("Choose a role.");
    await addStaff(text(formData, "name"), role, text(formData, "secret"));
    redirect("/admin?section=staff&ok=Staff%20added");
  });
}

export async function setSecretAction(formData: FormData) {
  await run("/admin?section=staff", undefined, async () => {
    await requireArea("admin");
    await setStaffSecret(Number(formData.get("id")), text(formData, "secret"));
    redirect("/admin?section=staff&ok=Sign-in%20updated");
  });
}

export async function setActiveAction(formData: FormData) {
  await run("/admin?section=staff", undefined, async () => {
    await requireArea("admin");
    await setStaffActive(Number(formData.get("id")), text(formData, "active") === "1");
    redirect("/admin?section=staff&ok=Staff%20updated");
  });
}
