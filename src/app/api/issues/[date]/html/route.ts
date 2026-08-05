import { getIssue } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Raw, downloadable HTML for one issue (the archived email document). */
export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid date. Use YYYY-MM-DD.", { status: 400 });
  }
  let html: string | null = null;
  try {
    const issue = await getIssue(date);
    html = issue?.html ?? null;
  } catch (err) {
    return new Response(`Database error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
  if (!html) return new Response("Issue not found.", { status: 404 });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `inline; filename="morning-shelf-${date}.html"`,
      "cache-control": "public, max-age=3600",
    },
  });
}
