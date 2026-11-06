import { NextResponse } from "next/server";
import { addMenuItem, updateMenuItem, listMenu } from "@/lib/domain";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      priceNu,
      active = true,
      categoryId,
      trackStock = false,
      reorderQty = 0,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 });
    }

    if (id) {
      // Update existing item
      await updateMenuItem(Number(id), {
        name: name.trim(),
        priceNu: Number(priceNu) || 0,
        active: Boolean(active),
        categoryId: categoryId ? Number(categoryId) : undefined,
        trackStock: Boolean(trackStock),
        reorderQty: Number(reorderQty) || 0,
      });
    } else {
      // Create new item
      if (!categoryId) {
        return NextResponse.json({ error: "Category is required for new item" }, { status: 400 });
      }
      await addMenuItem({
        name: name.trim(),
        priceNu: Number(priceNu) || 0,
        categoryId: Number(categoryId),
      });
    }

    const updatedMenu = await listMenu(undefined, true);
    return NextResponse.json({ ok: true, menu: updatedMenu });
  } catch (error) {
    console.error("v2 admin item error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Item operation failed" },
      { status: 400 }
    );
  }
}
