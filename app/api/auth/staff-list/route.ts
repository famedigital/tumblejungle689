import { NextResponse } from "next/server";
import { listStaff } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const staff = await listStaff();
    const publicList = staff
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
      }));

    return NextResponse.json({ ok: true, staff: publicList });
  } catch (error) {
    console.error("Staff list fetch error:", error);
    return NextResponse.json({ ok: true, staff: [] });
  }
}
