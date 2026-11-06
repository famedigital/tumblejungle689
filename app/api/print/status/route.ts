import { getSession } from "@/lib/auth";
import { printAgentStatus } from "@/lib/print-jobs";
import { can } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !can(session.role, "admin")) {
    return Response.json({ ok: false, error: "Admin only." }, { status: 401 });
  }
  const status = await printAgentStatus();
  const lastSeenMs = status.lastSeen ? Date.parse(status.lastSeen) : 0;
  const ageSec = lastSeenMs ? Math.max(0, Math.round((Date.now() - lastSeenMs) / 1000)) : null;
  const online = ageSec != null && ageSec < 45;
  return Response.json({ ok: true, ...status, ageSec, online });
}
