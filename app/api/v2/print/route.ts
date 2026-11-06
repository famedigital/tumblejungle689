import { NextResponse } from "next/server";
import { enqueuePrintJob } from "@/lib/print-jobs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { kind = "slip", body: printBody = "" } = body;

    if (!printBody.trim()) {
      return NextResponse.json({ error: "Empty print body" }, { status: 400 });
    }

    const job = await enqueuePrintJob(kind, printBody);
    return NextResponse.json({ ok: true, id: job.id });
  } catch (error) {
    console.error("v2 print error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Print enqueue failed" },
      { status: 500 }
    );
  }
}
