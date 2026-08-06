import { getLatestIssue } from "@/lib/db";

export const dynamic = "force-dynamic";

const NOT_FOUND = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>No issues yet</title></head><body style="font-family:sans-serif;background:#f4f1ea;color:#20242c;padding:40px 20px;"><p>No issues yet. <a href="/" style="color:#b3541e;">Back to the archive</a></p></body></html>`;

/**
 * Web version of the most recent shipped issue, served directly (no iframe) so
 * the document's own viewport meta makes it fit mobile screens.
 */
export async function GET() {
  let html: string | null = null;
  try {
    const issue = await getLatestIssue();
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
