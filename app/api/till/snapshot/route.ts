import { getSession } from "@/lib/auth";
import { loadTillSnapshot } from "@/lib/till-apply";
import { can } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !can(session.role, "cashier")) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }
  const term = new URL(request.url).searchParams.get("q") ?? "";
  const snapshot = await loadTillSnapshot(term);
  return Response.json(snapshot);
}
