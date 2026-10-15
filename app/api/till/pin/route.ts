import { findStaffBySecret, getSession } from "@/lib/auth";
import { can } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !can(session.role, "cashier")) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }
  const body = (await request.json()) as { secret?: string };
  const secret = String(body.secret ?? "").trim();
  if (!secret) {
    return Response.json({ ok: false, error: "Enter the owner PIN." }, { status: 400 });
  }
  const staff = await findStaffBySecret(secret);
  if (!staff || staff.role !== "admin") {
    return Response.json({ ok: false, error: "Owner PIN was not recognised." }, { status: 401 });
  }
  return Response.json({ ok: true, name: staff.name });
}
