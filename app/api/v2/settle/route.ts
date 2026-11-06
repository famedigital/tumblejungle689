import { NextResponse } from "next/server";
import { getSettings, settleVisit } from "@/lib/domain";
import { enqueuePrintJob } from "@/lib/print-jobs";
import type { PayMethod } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      visitId,
      method = "cash",
      amountNu,
      journal = "",
      payBank = "",
      staffName = "Floor Staff",
      deviceLabel = "Mobile Device",
      printReceipt = true,
    } = body;

    if (!visitId) {
      return NextResponse.json({ error: "Missing visitId" }, { status: 400 });
    }

    const payMethod: PayMethod = method === "bank_qr" ? "bank_qr" : "cash";

    const settled = await settleVisit(
      Number(visitId),
      payMethod,
      String(journal || "").trim(),
      String(payBank || "").trim(),
    );

    const settings = await getSettings();

    // Format receipt thermal slip
    const receiptTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const receiptDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    const linesText = settled.lines
      .map(
        (l) =>
          `${String(l.qty).padStart(2, " ")}x ${l.name.padEnd(20, " ").slice(0, 20)} Nu.${String(l.amountNu).padStart(5, " ")}`
      )
      .join("\n");

    const receiptBody = [
      "================================",
      `     ${settings.venueName || "TUMBLE JUNGLE"}`,
      settings.tagline ? `   ${settings.tagline}` : "",
      settings.address ? `   ${settings.address}` : "",
      settings.phone ? `   Tel: ${settings.phone}` : "",
      "================================",
      `RECEIPT NO  : #${settled.receiptNo || settled.id}`,
      `DATE / TIME : ${receiptDate} ${receiptTime}`,
      `PASS CODE   : ${settled.code}`,
      settled.guardianName ? `CUSTOMER    : ${settled.guardianName}` : "",
      settled.phone && settled.phone !== "00000000" ? `PHONE       : ${settled.phone}` : "",
      "--------------------------------",
      linesText || "PLAY ADMISSION",
      "--------------------------------",
      `TOTAL PAID  : Nu. ${amountNu || settled.dueNu || 0}`,
      `PAY METHOD  : ${payMethod.toUpperCase()}`,
      journal ? `REF / JRNL  : ${journal}` : "",
      "--------------------------------",
      `HANDLED BY  : ${staffName}`,
      `DEVICE      : ${deviceLabel}`,
      "--------------------------------",
      settings.receiptThanks || "Thank you for visiting Tumble Jungle!",
      "================================",
    ]
      .filter(Boolean)
      .join("\n");

    let printJob = null;
    if (printReceipt) {
      const job = await enqueuePrintJob("receipt", receiptBody);
      printJob = {
        id: String(job.id),
        kind: "receipt",
        title: `Receipt #${settled.receiptNo || settled.id} (${settled.code})`,
        body: receiptBody,
        target: "counter",
        staffName,
        deviceLabel,
        timestamp: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      ok: true,
      visit: settled,
      receiptNo: settled.receiptNo,
      printJob,
    });
  } catch (error) {
    console.error("v2 settle error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settlement failed" },
      { status: 400 }
    );
  }
}
