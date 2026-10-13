import { getSession } from "@/lib/auth";
import { searchHits } from "@/lib/domain";
import { can } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !can(session.role, "cashier")) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }
  const term = new URL(request.url).searchParams.get("q") ?? "";
  const hits = await searchHits(term);
  return Response.json({ hits });
}
