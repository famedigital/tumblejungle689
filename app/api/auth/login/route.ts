import { NextResponse } from "next/server";
import { findStaffBySecret, setSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const secret = String(body.secret ?? "").trim();

    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "Please enter your staff PIN or password." },
        { status: 400 }
      );
    }

    const staff = await findStaffBySecret(secret);
    if (!staff) {
      return NextResponse.json(
        { ok: false, error: "Incorrect PIN or password. Please try again." },
        { status: 401 }
      );
    }

    // Set enterprise HTTP-only signed session cookie
    await setSession({
      staffId: staff.id,
      name: staff.name,
      role: staff.role,
    });

    return NextResponse.json({
      ok: true,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
      },
    });
  } catch (error) {
    console.error("Auth login error:", error);
    return NextResponse.json(
      { ok: false, error: "An unexpected authentication error occurred." },
      { status: 500 }
    );
  }
}
