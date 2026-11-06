import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  cancelHold,
  holdPlay,
  leaveOnTime,
  voidVisit,
  waiveOvertime,
} from "@/lib/domain";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }
  try {
    const body = await req.json();
    const visitId = Number(body.visitId);
    const action = String(body.action || "");
    if (!visitId || !action) {
      return NextResponse.json({ error: "visitId and action required." }, { status: 400 });
    }

    const actor = {
      id: session.staffId,
      name: session.name,
    };

    let visit;
    if (action === "hold") visit = await holdPlay(visitId);
    else if (action === "leave") visit = await leaveOnTime(visitId, actor);
    else if (action === "cancel") visit = await cancelHold(visitId, actor);
    else if (action === "waive") {
      if (session.role !== "admin") {
        return NextResponse.json({ error: "Admin only to waive overtime." }, { status: 403 });
      }
      visit = await waiveOvertime(visitId, actor);
    }
    else if (action === "void") {
      if (session.role !== "admin") {
        return NextResponse.json({ error: "Admin only to void." }, { status: 403 });
      }
      visit = await voidVisit(visitId, actor);
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, visit });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 400 },
    );
  }
}
