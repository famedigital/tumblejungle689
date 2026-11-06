import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listRecentTransactions } from "@/lib/domain";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }
  try {
    const recent = await listRecentTransactions(50);
    return NextResponse.json({ ok: true, recent });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load recent" },
      { status: 500 },
    );
  }
}
