import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    console.error("Session fetch error:", error);
    return NextResponse.json({ ok: false, session: null });
  }
}
