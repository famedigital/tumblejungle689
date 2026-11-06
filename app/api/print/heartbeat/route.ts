import { touchPrintAgent } from "@/lib/print-jobs";

export const dynamic = "force-dynamic";

function tokenOf(request: Request) {
  const header =
    request.headers.get("x-print-token") ||
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")!.slice(7)
      : "");
  return String(header || "").trim();
}

/** Agent pings this every few seconds so Admin → Test shows online. */
export async function GET(request: Request) {
  try {
    const token = tokenOf(request);
    await touchPrintAgent(token);
    return Response.json({ ok: true, at: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Heartbeat failed." },
      { status: 401 },
    );
  }
}
