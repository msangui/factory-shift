# Newsletter dispatcher (Cloudflare Worker)

Fires the daily pipeline **on time** by sending a GitHub `workflow_dispatch` from
a Cloudflare Cron Trigger.

## Why this exists

GitHub's `schedule:` event delivery is best-effort. For these repos it was
arriving **4–9 hours late every day** — the scheduled runs fired, just far too
late for a morning newsletter, so issues had to be triggered by hand. A
`workflow_dispatch` sent through the REST API is **not** subject to that queue:
GitHub runs it immediately (manual runs start within seconds). So we schedule on
Cloudflare (reliable) and dispatch to GitHub (immediate).

The `schedule:` crons in each repo's `.github/workflows/daily.yml` are kept as a
free redundant backstop; if one fires it's a ~19s no-op thanks to the pipeline's
per-date idempotency.

Covers **both** `msangui/factory-shift` and `msangui/morning-shelf` from one
deployment (see `REPOS` in `src/worker.ts`).

## One-time setup

1. **Create a fine-grained PAT** — github.com → Settings → Developer settings →
   Fine-grained tokens → Generate new token:
   - Resource owner: `msangui`
   - Repository access → Only select repositories: `factory-shift` **and** `morning-shelf`
   - Permissions → Repository → **Actions: Read and write** (Metadata: Read is added automatically)
   - Set an expiry and a calendar reminder to rotate it.

2. **Install deps and log in:**
   ```bash
   cd ops/dispatch-worker
   npm install
   npx wrangler login
   ```

3. **Store secrets** (never committed):
   ```bash
   npx wrangler secret put GITHUB_TOKEN      # paste the fine-grained PAT
   npx wrangler secret put TRIGGER_KEY       # optional: any random string, gates /dispatch
   ```

4. **Deploy:**
   ```bash
   npx wrangler deploy
   ```

## Verify

- **Manual (immediate):** `curl "https://newsletter-dispatcher.<your-subdomain>.workers.dev/dispatch?key=<TRIGGER_KEY>"`
  → returns `[{"repo":"msangui/factory-shift","status":204,"ok":true}, …]`, and a
  new **workflow_dispatch** run appears in each repo's Actions within seconds.
- **Scheduled:** next weekday, Cloudflare dashboard → the Worker → *Cron Events*
  shows the 10:05/11:05 UTC firings, and each repo shows a `workflow_dispatch`-event
  run that started on time (not the hours-late `schedule` run).
- **Logs:** `npx wrangler tail` prints a `dispatch [...]` line per firing.

## Notes

- The PAT lives only in the encrypted Worker secret, scoped to two repos with a
  single permission. Rotate on expiry.
- Cloudflare free tier covers this (a handful of cron invocations per day).
- To change times or repos, edit `wrangler.toml` (`crons`) or `src/worker.ts`
  (`REPOS`) and redeploy.
