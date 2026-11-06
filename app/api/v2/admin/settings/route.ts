import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveRates, saveExtraPerMin, saveBank, saveVenue, saveReceipt, getSettings } from "@/lib/domain";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { section, data } = body;

    if (section === "rates") {
      if (Array.isArray(data.rates)) {
        await saveRates(data.rates);
      }
      if (typeof data.extraPerMinNu === "number") {
        await saveExtraPerMin(data.extraPerMinNu);
      }
    } else if (section === "bank") {
      await saveBank({
        payload: String(data.payload || "").trim(),
        account: String(data.account || "").trim(),
        payee: String(data.payee || "").trim(),
        city: String(data.city || "Thimphu").trim(),
      });
    } else if (section === "venue") {
      await saveVenue({
        venueName: String(data.venueName || "Tumble Jungle").trim(),
        tagline: String(data.tagline || "").trim(),
        address: String(data.address || "").trim(),
        hours: String(data.hours || "").trim(),
        phone: String(data.phone || "").trim(),
        ownerPhone: data.ownerPhone ? String(data.ownerPhone).trim() : undefined,
        about: String(data.about || "").trim(),
        playBlurb: String(data.playBlurb || "").trim(),
        eatBlurb: String(data.eatBlurb || "").trim(),
      });
    } else if (section === "receipt") {
      await saveReceipt({
        note: String(data.note || "").trim(),
        thanks: String(data.thanks || "Thank you for visiting Tumble Jungle!").trim(),
        rules: String(data.rules || "").trim(),
      });
    }

    const updated = await getSettings();
    return NextResponse.json({ ok: true, settings: updated });
  } catch (error) {
    console.error("v2 admin settings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settings update failed" },
      { status: 400 }
    );
  }
}
