/**
 * Newsletter dispatcher — a Cloudflare Worker that fires the daily pipeline on
 * time.
 *
 * Why this exists: GitHub's `schedule:` event delivery is best-effort and, for
 * these repos, was arriving 4-9 HOURS late every day (the runs fired, just far
 * too late for a morning newsletter — so the issue had to be triggered by hand).
 * A `workflow_dispatch` sent through the REST API is NOT subject to that queue:
 * GitHub runs it immediately (manual runs start within seconds). So instead of
 * relying on GitHub's clock, a reliable external scheduler (Cloudflare Cron
 * Triggers) dispatches the workflow at the intended time.
 *
 * The GitHub `schedule:` crons in each repo's daily.yml are kept as a free,
 * redundant backstop — if they ever fire before this Worker, the pipeline's
 * per-date idempotency turns the duplicate into a ~19s no-op.
 */

export interface Env {
  /** Fine-grained PAT with Actions: read/write on the two repos. Worker secret. */
  GITHUB_TOKEN: string;
  /** Optional shared secret gating the manual /dispatch endpoint. Worker secret. */
  TRIGGER_KEY?: string;
}

const REPOS = ["msangui/factory-shift", "msangui/morning-shelf"] as const;
const WORKFLOW_FILE = "daily.yml";
/** workflow_dispatch resolves the workflow from a branch; use the default branch. */
const REF = "main";

interface DispatchResult {
  repo: string;
  status: number;
  ok: boolean;
  detail?: string;
}

async function dispatch(repo: string, token: string): Promise<DispatchResult> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "newsletter-dispatcher",
        "Content-Type": "application/json",
      },
      // `inputs` omitted: the workflow's `force` input defaults to false, so a
      // day whose issue already exists is a cheap no-op (per-date idempotency).
      body: JSON.stringify({ ref: REF }),
    },
  );
  const ok = res.status === 204; // GitHub returns 204 No Content on success.
  return { repo, status: res.status, ok, detail: ok ? undefined : await res.text() };
}

function dispatchAll(token: string): Promise<DispatchResult[]> {
  return Promise.all(REPOS.map((repo) => dispatch(repo, token)));
}

export default {
  // Cron Trigger entrypoint — fires on the schedule in wrangler.toml.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.GITHUB_TOKEN) {
      console.error("dispatch: GITHUB_TOKEN secret is not set");
      return;
    }
    ctx.waitUntil(
      dispatchAll(env.GITHUB_TOKEN).then((results) =>
        console.log("dispatch", JSON.stringify(results)),
      ),
    );
  },

  // Manual trigger / health check. GET /dispatch?key=<TRIGGER_KEY> fires now.
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/dispatch") {
      if (!env.TRIGGER_KEY || url.searchParams.get("key") !== env.TRIGGER_KEY) {
        return new Response("forbidden\n", { status: 403 });
      }
      const results = await dispatchAll(env.GITHUB_TOKEN);
      const allOk = results.every((r) => r.ok);
      return Response.json(results, { status: allOk ? 200 : 502 });
    }
    return new Response("newsletter-dispatcher: ok\n");
  },
} satisfies ExportedHandler<Env>;
