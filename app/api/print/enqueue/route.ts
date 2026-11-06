import { getSession } from "@/lib/auth";
import { enqueuePrintJob } from "@/lib/print-jobs";
import { can } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!can(session.role, "cashier") && !can(session.role, "admin"))) {
    return Response.json({ ok: false, error: "Sign in again." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { kind?: string; mode?: string; text?: string };
    const kind = String(body.kind || body.mode || "slip");
    const text = String(body.text || "");
    const job = await enqueuePrintJob(kind, text);
    return Response.json({ ok: true, id: job.id });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not queue print." },
      { status: 400 },
    );
  }
}
