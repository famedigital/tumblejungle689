import { NextResponse } from "next/server";
import {
  buildDayReport,
  catalogToday,
  daySummary,
  getSettings,
  listCategories,
  listMenu,
  listRecentPurchases,
  listStaff,
  listStockItems,
} from "@/lib/domain";

export async function GET() {
  try {
    const [settings, day, menu, stock, categories, staff, dayReport, catalog, purchases] =
      await Promise.all([
        getSettings(),
        daySummary(),
        listMenu(undefined, true), // all items including inactive
        listStockItems(),
        listCategories(),
        listStaff(),
        buildDayReport().catch(() => null),
        catalogToday().catch(() => ({ dishes: {}, play: {} })),
        listRecentPurchases(40).catch(() => []),
      ]);

    return NextResponse.json({
      settings: {
        venueName: settings.venueName,
        tagline: settings.tagline,
        address: settings.address,
        hours: settings.hours,
        phone: settings.phone,
        ownerPhone: settings.ownerPhone,
        about: settings.about,
        rates: settings.rates,
        extraPerMinNu: settings.extraPerMinNu,
        bankPayload: settings.bankPayload,
        bankAccount: settings.bankAccount,
        payee: settings.payee,
        city: settings.city,
        receiptThanks: settings.receiptThanks,
        receiptNote: settings.receiptNote,
      },
      day: {
        totalNu: day.totalNu,
        playNu: day.playNu,
        foodNu: day.foodNu,
        cashNu: day.cashNu,
        bankNu: day.bankNu,
        settledCount: day.settledCount,
        openCount: day.openCount,
      },
      dayReport,
      menu,
      stock,
      purchases,
      categories,
      staff,
      catalogToday: catalog,
    });
  } catch (error) {
    console.error("v2 admin data error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load admin data" },
      { status: 500 }
    );
  }
}
