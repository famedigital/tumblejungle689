import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { addPlayBlock } from "@/lib/domain";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }
  try {
    const body = await req.json();
    const visitId = Number(body.visitId);
    const minutes = Number(body.minutes);
    if (!visitId || !minutes) {
      return NextResponse.json({ error: "Visit and minutes required." }, { status: 400 });
    }
    const visit = await addPlayBlock(visitId, minutes, String(body.phone || ""));
    return NextResponse.json({ ok: true, visit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extend failed" },
      { status: 400 },
    );
  }
}
