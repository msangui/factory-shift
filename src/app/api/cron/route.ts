import { NEWSLETTER_TZ, runPipeline } from "@/pipeline/run";
import { hourInTz } from "@/lib/util";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The target local hour for the daily send. */
const TARGET_HOUR_ET = 6;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // No secret configured (dev): allow.
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  // Vercel Cron runs in UTC and has no timezone support, so we schedule two
  // weekday crons (10:00 and 11:00 UTC) and only proceed when it is actually
  // 06:00 in New York. Exactly one fires per weekday across EST/EDT. `force`
  // bypasses the gate for manual runs. (See ASSUMPTIONS.md.)
  const nowEtHour = hourInTz(new Date(), NEWSLETTER_TZ);
  if (!force && nowEtHour !== TARGET_HOUR_ET) {
    log.info("cron.skip_off_hour", { nowEtHour, target: TARGET_HOUR_ET });
    return Response.json({ skipped: true, reason: `not ${TARGET_HOUR_ET}:00 ET (currently ${nowEtHour}:00)` });
  }

  try {
    const summary = await runPipeline({ force });
    return Response.json(summary);
  } catch (err) {
    log.error("cron.pipeline_error", { error: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
