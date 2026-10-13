import { getSession } from "@/lib/auth";
import { applyTillBatch } from "@/lib/till-apply";
import type { TillOp } from "@/lib/till-op";
import { can } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !can(session.role, "cashier")) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }
  const body = (await request.json()) as { ops?: TillOp[] };
  const ops = Array.isArray(body.ops) ? body.ops : [];
  const result = await applyTillBatch(ops, session);
  return Response.json(result);
}
