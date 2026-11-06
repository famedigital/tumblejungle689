import { NextResponse } from "next/server";
import { adjustStock, receivePurchase, listStockItems } from "@/lib/domain";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, itemId, delta, note = "", supplierName, lines, staffId = 1, staffName = "Admin" } = body;
    const actor = { id: Number(staffId) || 1, name: String(staffName || "Admin") };

    if (action === "adjust") {
      if (!itemId || !delta) {
        return NextResponse.json({ error: "Missing itemId or delta" }, { status: 400 });
      }
      await adjustStock(Number(itemId), Number(delta), note, actor);
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

    const updatedStock = await listStockItems();
    return NextResponse.json({ ok: true, stock: updatedStock });
  } catch (error) {
    console.error("v2 admin stock error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stock update failed" },
      { status: 400 }
    );
  }
}
