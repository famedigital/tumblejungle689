"use server";

import { redirect } from "next/navigation";
import { clearSession, findStaffBySecret, requireArea, setSession } from "@/lib/auth";
import {
  addCategory,
  addMenuItem,
  addPlayBlock,
  addStaff,
  addTabItem,
  changeLineQty,
  createVisit,
  payOutlet,
  payPlayDue,
  removeLatestUnpaidBlock,
  removeTabLine,
  cancelHold,
  saveBank,
  saveRates,
  saveReceipt,
  saveKot,
  saveVenue,
  setStaffActive,
  setStaffSecret,
  settleVisit,
  updateMenuItem,
} from "@/lib/domain";
import type { Outlet, PayMethod, Role } from "@/lib/types";

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
  redirect(`${path}?${params.toString()}`);
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
  const staff = findStaffBySecret(text(formData, "secret"));
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
    const visit = createVisit({
      phone: text(formData, "phone"),
      name: text(formData, "name"),
      childCount: Number(formData.get("childCount") || 1),
      minutes: Number(formData.get("minutes")),
      method: methodOf(formData),
      ...(text(formData, "method") === "split"
        ? { cashNu: Math.round(Number(formData.get("cashNu"))), bankNu: Math.round(Number(formData.get("bankNu"))) }
        : {}),
    });
    redirect(`/stickers/${visit.code}`);
  });
}

export async function addPlayAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/desk") ? "desk" : "cashier");
    const visit = addPlayBlock(visitId(formData), Number(formData.get("minutes")));
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function removeLineAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(areaFor(back));
    const visit = removeTabLine(Number(formData.get("lineId")));
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function cancelHoldAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(areaFor(back));
    cancelHold(visitId(formData));
    redirect(`${back}?ok=${encodeURIComponent("Hold removed")}`);
  });
}

export async function removePlayAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/desk") ? "desk" : "cashier");
    const visit = removeLatestUnpaidBlock(visitId(formData));
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function saveKotAction(visitId: number, tableNo: string, lineIds: number[]) {
  await requireArea("cashier");
  saveKot(visitId, tableNo, lineIds);
}

export async function addItemAction(formData: FormData) {
  const outlet = outletOf(text(formData, "outlet"));
  const back = text(formData, "back") || `/counter/${outlet}`;
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/cashier") ? "cashier" : outlet);
    const visit = addTabItem(visitId(formData), Number(formData.get("itemId")), outlet);
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function qtyAction(formData: FormData) {
  const outlet = outletOf(text(formData, "outlet"));
  const back = text(formData, "back") || `/counter/${outlet}`;
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/cashier") ? "cashier" : outlet);
    const visit = changeLineQty(Number(formData.get("lineId")), Number(formData.get("delta")));
    redirect(`${back}?q=${visit.code}`);
  });
}

export async function payOutletAction(formData: FormData) {
  const outlet = outletOf(text(formData, "outlet"));
  const back = `/counter/${outlet}`;
  await run(back, text(formData, "code"), async () => {
    await requireArea(outlet);
    const visit = payOutlet(visitId(formData), outlet, methodOf(formData));
    redirect(`${back}?q=${visit.code}&ok=Payment%20taken`);
  });
}

export async function payPlayAction(formData: FormData) {
  const back = text(formData, "back") || "/cashier";
  await run(back, text(formData, "code"), async () => {
    await requireArea(back.startsWith("/desk") ? "desk" : "cashier");
    const visit = payPlayDue(visitId(formData), methodOf(formData), back.startsWith("/desk") ? "desk" : "cashier");
    redirect(`${back}?q=${visit.code}&ok=Playtime%20paid`);
  });
}

export async function settleAction(formData: FormData) {
  await run("/cashier", text(formData, "code"), async () => {
    await requireArea("cashier");
    const method = text(formData, "method");
    const closed = settleVisit(
      visitId(formData),
      method === "split"
        ? { cashNu: Math.round(Number(formData.get("cashNu"))), bankNu: Math.round(Number(formData.get("bankNu"))) }
        : methodOf(formData),
    );
    redirect(`/receipt/${closed.code}`);
  });
}

export async function saveVenueAction(formData: FormData) {
  await run("/admin", undefined, async () => {
    await requireArea("admin");
    saveVenue({
      venueName: text(formData, "venueName"),
      tagline: text(formData, "tagline"),
      address: text(formData, "address"),
      hours: text(formData, "hours"),
      phone: text(formData, "phone"),
      about: text(formData, "about"),
      playBlurb: text(formData, "playBlurb"),
      eatBlurb: text(formData, "eatBlurb"),
    });
    redirect("/admin?ok=Venue%20page%20saved");
  });
}

export async function saveRatesAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/products" ? "/admin/products" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    const rates = JSON.parse(text(formData, "rates")) as { minutes: number; amountNu: number }[];
    saveRates(rates);
    finish(formData, "/admin", "Play rates saved", text(formData, "desk"));
  });
}

export async function saveBankAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/bank" ? "/admin/bank" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    saveBank({
      payload: text(formData, "payload"),
      account: text(formData, "account"),
      payee: text(formData, "payee"),
      city: text(formData, "city"),
    });
    finish(formData, "/admin", "Bank details saved");
  });
}

export async function saveReceiptAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/receipt" ? "/admin/receipt" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    saveReceipt({
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
    addCategory(text(formData, "name"), outletOf(text(formData, "outlet")));
    finish(formData, "/admin", "Category added");
  });
}

export async function addMenuItemAction(formData: FormData) {
  const path = text(formData, "back") === "/admin/products" ? "/admin/products" : "/admin";
  await run(path, undefined, async () => {
    await requireArea("admin");
    const id = addMenuItem({
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
    updateMenuItem(id, {
      name: text(formData, "name"),
      priceNu: Number(formData.get("priceNu")),
      active: formData.get("active") === "on",
      categoryId: Number(formData.get("categoryId")) || undefined,
    });
    finish(formData, "/admin", "Menu updated", `item-${id}`);
  });
}

export async function addStaffAction(formData: FormData) {
  await run("/admin", undefined, async () => {
    await requireArea("admin");
    const role = text(formData, "role") as Role;
    if (!ROLES.includes(role)) throw new Error("Choose a role.");
    addStaff(text(formData, "name"), role, text(formData, "secret"));
    redirect("/admin?ok=Staff%20added");
  });
}

export async function setSecretAction(formData: FormData) {
  await run("/admin", undefined, async () => {
    await requireArea("admin");
    setStaffSecret(Number(formData.get("id")), text(formData, "secret"));
    redirect("/admin?ok=Sign-in%20updated");
  });
}

export async function setActiveAction(formData: FormData) {
  await run("/admin", undefined, async () => {
    await requireArea("admin");
    setStaffActive(Number(formData.get("id")), text(formData, "active") === "1");
    redirect("/admin?ok=Staff%20updated");
  });
}
