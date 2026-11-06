import { NextResponse } from "next/server";
import { createVisit, addTabItem, getSettings, listMenu } from "@/lib/domain";
import { enqueuePrintJob } from "@/lib/print-jobs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      phone,
      guardianName,
      childCount,
      minutes,
      socksCount = 0,
      method = "cash",
      staffName = "Floor Staff",
      deviceLabel = "Mobile Device",
      printWristband = true,
    } = body;

    const stationLabel = `${staffName} (${deviceLabel})`;

    // Create admission visit
    const visit = await createVisit({
      phone: String(phone || "").trim(),
      name: String(guardianName || "Child").trim(),
      childCount: Number(childCount) || 1,
      minutes: Number(minutes) || 60,
      method: method,
      station: stationLabel,
    });

    // If socks added, find socks item in menu and add to tab
    if (socksCount > 0) {
      const menu = await listMenu();
      const socksItem = menu.find((m) => /sock/i.test(m.name));
      if (socksItem) {
        for (let i = 0; i < socksCount; i++) {
          await addTabItem(visit.id, socksItem.id, socksItem.outlet || "cafe");
        }
      }
    }

    const settings = await getSettings();

    // Format thermal print ticket / wristband slip
    const printTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const printDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const exitTime = new Date(Date.now() + minutes * 60000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const ticketBody = [
      "================================",
      `     ${settings.venueName || "TUMBLE JUNGLE"}`,
      "     ENTRY PASS & WRISTBAND",
      "================================",
      `PASS CODE   : ${visit.code}`,
      `DATE / TIME : ${printDate} ${printTime}`,
      `GUARDIAN    : ${guardianName || "N/A"}`,
      `PHONE       : ${phone}`,
      `CHILDREN    : ${childCount}`,
      `DURATION    : ${minutes} MINS`,
      `VALID UNTIL : ${exitTime}`,
      socksCount > 0 ? `SOCKS       : ${socksCount} PAIR(S)` : "",
      "--------------------------------",
      `ISSUED BY   : ${staffName}`,
      `STATION     : ${deviceLabel}`,
      "--------------------------------",
      "   PLEASE WEAR WRISTBAND AT ALL   ",
      " TIMES INSIDE THE PLAY ARENA.    ",
      "================================",
    ]
      .filter(Boolean)
      .join("\n");

    let printJob = null;
    if (printWristband) {
      const job = await enqueuePrintJob("wristband", ticketBody);
      printJob = {
        id: String(job.id),
        kind: "wristband",
        title: `Pass ${visit.code} (${visit.guardianName || "Child"})`,
        body: ticketBody,
        staffName,
        deviceLabel,
        timestamp: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      ok: true,
      visit,
      printJob,
    });
  } catch (error) {
    console.error("v2 admit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admission failed" },
      { status: 400 }
    );
  }
}
