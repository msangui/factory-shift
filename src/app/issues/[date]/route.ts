import { getIssue } from "@/lib/db";

export const dynamic = "force-dynamic";

const NOT_FOUND = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Issue not found</title></head><body style="font-family:sans-serif;background:#f4f1ea;color:#20242c;padding:40px 20px;"><p>Issue not found. <a href="/" style="color:#b3541e;">Back to the archive</a></p></body></html>`;

/**
 * Web version of one issue. The stored HTML is a complete standalone document
 * (with its own viewport meta), so we serve it directly rather than embedding
 * it in an iframe — inside an iframe the inner viewport meta is ignored and
 * mobile browsers don't fit the content to the screen.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid date. Use YYYY-MM-DD.", { status: 400 });
  }
  let html: string | null = null;
  try {
    const issue = await getIssue(date);
    html = issue?.html ?? null;
  } catch {
    html = null;
  }
  if (!html) {
    return new Response(NOT_FOUND, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
