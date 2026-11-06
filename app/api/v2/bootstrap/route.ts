import { NextResponse } from "next/server";
import { dayTotals, getSettings, listMenu, listOpenVisits } from "@/lib/domain";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const [settings, day, menu, visits, staffRows] = await Promise.all([
      getSettings(),
      dayTotals(),
      listMenu(),
      listOpenVisits(),
      query().many<{ id: number; name: string; role: string }>(
        "SELECT id, name, role FROM staff WHERE active = 1 ORDER BY id ASC"
      ),
    ]);

    return NextResponse.json({
      venueName: settings.venueName || "Tumble Jungle",
      tagline: settings.tagline || "",
      phone: settings.phone || "",
      address: settings.address || "",
      rates: settings.rates,
      extraPerMinNu: settings.extraPerMinNu,
      bankPayload: settings.bankPayload,
      bankAccount: settings.bankAccount,
      payee: settings.payee || "Tumble Jungle",
      city: settings.city || "Thimphu",
      menu: menu.filter((m) => m.active),
      visits,
      staff: staffRows,
      todayNu: day.totalNu,
      playNu: day.playNu,
      foodNu: day.foodNu,
    });
  } catch (error) {
    console.error("v2 bootstrap error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bootstrap failed" },
      { status: 500 }
    );
  }
}
