import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  adjustStock,
  receivePurchase,
  listStockItems,
  listRecentPurchases,
  listMenu,
  updateMenuItem,
} from "@/lib/domain";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }
  try {
    const body = await req.json();
    const {
      action,
      itemId,
      delta,
      note = "",
      supplierName,
      lines,
      reorderQty,
      initialQty,
      staffId = 1,
      staffName = "Admin",
    } = body;
    const actor = { id: Number(staffId) || 1, name: String(staffName || "Admin") };

    if (action === "adjust") {
      if (!itemId || delta === undefined || delta === null) {
        return NextResponse.json({ error: "Missing itemId or delta" }, { status: 400 });
      }
      await adjustStock(Number(itemId), Number(delta), note, actor);
    } else if (action === "track") {
      if (!itemId) {
        return NextResponse.json({ error: "Missing itemId to track" }, { status: 400 });
      }
      const allMenu = await listMenu(undefined, true);
      const targetItem = allMenu.find((m) => m.id === Number(itemId));
      if (!targetItem) {
        return NextResponse.json({ error: "Item not found in menu" }, { status: 404 });
      }
      await updateMenuItem(targetItem.id, {
        name: targetItem.name,
        priceNu: targetItem.priceNu,
        active: targetItem.active,
        categoryId: targetItem.categoryId,
        trackStock: true,
        reorderQty: Number(reorderQty) || 5,
      });
      if (initialQty && Number(initialQty) > 0) {
        await adjustStock(targetItem.id, Number(initialQty), "Initial stock count", actor);
      }
    } else if (action === "reorder_level") {
      if (!itemId || reorderQty === undefined) {
        return NextResponse.json({ error: "Missing itemId or reorderQty" }, { status: 400 });
      }
      const allMenu = await listMenu(undefined, true);
      const targetItem = allMenu.find((m) => m.id === Number(itemId));
      if (!targetItem) {
        return NextResponse.json({ error: "Item not found in menu" }, { status: 404 });
      }
      await updateMenuItem(targetItem.id, {
        name: targetItem.name,
        priceNu: targetItem.priceNu,
        active: targetItem.active,
        categoryId: targetItem.categoryId,
        trackStock: true,
        reorderQty: Math.max(0, Number(reorderQty) || 0),
      });
    } else if (action === "purchase") {
      if (!supplierName || !lines || !Array.isArray(lines) || lines.length === 0) {
        return NextResponse.json({ error: "Supplier name and purchase lines required" }, { status: 400 });
      }
      await receivePurchase({
        supplierName: String(supplierName).trim(),
        note: String(note).trim(),
        lines,
        actor,
      });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const [updatedStock, purchases] = await Promise.all([
      listStockItems(),
      listRecentPurchases(40).catch(() => []),
    ]);

    return NextResponse.json({ ok: true, stock: updatedStock, purchases });
  } catch (error) {
    console.error("v2 admin stock error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stock update failed" },
      { status: 400 }
    );
  }
}
