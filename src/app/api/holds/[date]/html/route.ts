import { getHold } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Preview the HELD draft's rendered HTML (which may differ from the live issue
 * when a force re-run held while a shipped version stayed live). Guarded by
 * CRON_SECRET like the holds page, since this is unpublished content.
 */
export async function GET(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid date. Use YYYY-MM-DD.", { status: 400 });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
    if (url.searchParams.get("key") !== secret && !bearer) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let html: string | null = null;
  try {
    const hold = await getHold(date);
    html = hold?.html || null;
  } catch (err) {
    return new Response(`Database error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
  if (!html) return new Response("No held draft with stored HTML for that date.", { status: 404 });

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
