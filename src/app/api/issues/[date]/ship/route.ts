import { shipHeldIssue } from "@/lib/db";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Manually ship a held issue after review (spec: "A held issue may ship
 * manually after human review"). Guarded by CRON_SECRET, supplied either as
 * `?key=` (so the /admin/holds button works) or `Authorization: Bearer`.
 * On success, redirects to the now-live issue page.
 */
async function handle(req: Request, date: string): Promise<Response> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid date. Use YYYY-MM-DD.", { status: 400 });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
    if (key !== secret && !bearer) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const status = await shipHeldIssue(date);
    if (!status) {
      return Response.json({ error: "no held issue for that date" }, { status: 404 });
    }
    log.info("issue.manual_ship", { date, status });
    // Redirect to the now-live issue so the reviewer sees it immediately.
    return Response.redirect(new URL(`/issues/${date}`, req.url), 303);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return handle(req, date);
}
