import { NextResponse } from "next/server";
import { getVisitById, listMenu, addTabItem, addWalkInItem, saveKot } from "@/lib/domain";
import { enqueuePrintJob } from "@/lib/print-jobs";
import { query } from "@/lib/db";
import type { Outlet, VisitView } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      visitId,
      tableNo = "",
      notes = "",
      items = [],
      staffName = "Floor Staff",
      deviceLabel = "Mobile Device",
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items ordered" }, { status: 400 });
    }

    const menu = await listMenu();
    let currentVisit: VisitView | null = null;
    let targetVisitId = visitId ? Number(visitId) : 0;

    if (targetVisitId) {
      currentVisit = await getVisitById(targetVisitId);
      if (!currentVisit || currentVisit.status !== "open") {
        return NextResponse.json({ error: "Visit is not open" }, { status: 400 });
      }
    }

    // Add each ordered item
    for (let i = 0; i < items.length; i++) {
      const orderItem = items[i];
      const menuItem = menu.find((m) => m.id === orderItem.itemId) || menu[0];
      if (!menuItem) continue;

      const outlet: Outlet = (orderItem.outlet || menuItem.outlet || "cafe") as Outlet;
      const count = Math.max(1, Number(orderItem.qty) || 1);

      if (!currentVisit) {
        // First item creates walk-in / table visit
        currentVisit = await addWalkInItem(menuItem.id, outlet);
        targetVisitId = currentVisit.id;
        // If qty > 1, add remaining
        for (let q = 1; q < count; q++) {
          currentVisit = await addTabItem(targetVisitId, menuItem.id, outlet);
        }
      } else {
        for (let q = 0; q < count; q++) {
          currentVisit = await addTabItem(targetVisitId, menuItem.id, outlet);
        }
      }
    }

    if (!currentVisit) {
      return NextResponse.json({ error: "Failed to create or update order" }, { status: 400 });
    }

    // Fire KOT lines
    const unfiredLineIds = currentVisit.lines
      .filter((l) => l.firedQty < l.qty)
      .map((l) => l.id);

    if (unfiredLineIds.length > 0 || tableNo.trim()) {
      currentVisit = await saveKot(
        targetVisitId,
        tableNo.trim() || currentVisit.tableNo || "Floor",
        unfiredLineIds
      );
    }

    // Build thermal KOT ticket
    const orderTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const orderDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

    const kotLines = items.map(
      (item: { qty: number; name: string }) =>
        `${String(item.qty).padStart(2, " ")}x  ${item.name}`
    );

    const kotBody = [
      "================================",
      "       *** KITCHEN ORDER ***    ",
      "================================",
      `TABLE / REF : ${tableNo || currentVisit?.code || "FLOOR"}`,
      `TIME        : ${orderDate} ${orderTime}`,
      `STAFF       : ${staffName}`,
      `DEVICE      : ${deviceLabel}`,
      "--------------------------------",
      "QTY   ITEM",
      "--------------------------------",
      ...kotLines,
      notes ? "--------------------------------\nNOTE: " + notes : "",
      "================================",
    ]
      .filter(Boolean)
      .join("\n");

    const printJobRecord = await enqueuePrintJob("kot", kotBody);

    const printJob = {
      id: String(printJobRecord.id),
      kind: "kot",
      title: `KOT: ${tableNo || currentVisit?.code || "Floor"}`,
      body: kotBody,
      target: "kitchen",
      staffName,
      deviceLabel,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      ok: true,
      visit: currentVisit,
      printJob,
    });
  } catch (error) {
    console.error("v2 order error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order failed" },
      { status: 400 }
    );
  }
}
