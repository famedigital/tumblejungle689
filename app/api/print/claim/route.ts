import { claimPrintJob, completePrintJob } from "@/lib/print-jobs";

export const dynamic = "force-dynamic";

function tokenOf(request: Request, body?: { token?: string }) {
  const header =
    request.headers.get("x-print-token") ||
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")!.slice(7)
      : "");
  return String(header || body?.token || "").trim();
}

/** Agent pulls the next queued slip. */
export async function GET(request: Request) {
  try {
    const token = tokenOf(request);
    const job = await claimPrintJob(token);
    if (!job) return Response.json({ ok: true, job: null });
    return Response.json({ ok: true, job });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Claim failed." },
      { status: 401 },
    );
  }
}

/** Agent marks a job done/failed. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; id?: number; ok?: boolean };
    const token = tokenOf(request, body);
    const id = Number(body.id);
    if (!Number.isFinite(id) || id < 1) {
      return Response.json({ ok: false, error: "Missing job id." }, { status: 400 });
    }
    await completePrintJob(token, id, body.ok !== false);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Complete failed." },
      { status: 401 },
    );
  }
}
