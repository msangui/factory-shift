# The Factory Shift

A daily **Automotive & Manufacturing** newsletter with a hard editorial bias toward
**technology and financial** news (earnings, M&A, capital allocation, plant capacity and
capex, EV/software-defined vehicles, ADAS/autonomy, factory automation and robotics,
industrial AI and IIoT, supply-chain and reshoring). Voice: Morning Brew — a smart friend
explaining business news over coffee.

Every issue is generated through **the Gauntlet**: a draft must pass six independent
critics before it ships. If it can't be fixed in three iterations, it's **held**, never
shipped degraded — unless `AUTO_PUBLISH_ON_HOLD=1` is explicitly set, an opt-in,
default-off deviation that removes this gate (see [`ASSUMPTIONS.md`](./ASSUMPTIONS.md)).

> **Naming.** Three candidates were floated before launch — *Shift Change*, *The Line*, and
> *Torque & Ledger*. The operator chose **The Factory Shift**.

---

## How it works

```
                            ┌──────────────── PUBLISH MODE (daily, 06:00 ET) ────────────────┐
  Vercel Cron ──▶ /api/cron ─▶ INGEST ─▶ DRAFT ─▶ GAUNTLET ─▶ REVISE ─▶ GAUNTLET ─▶ SHIP or HOLD
                                 │          │        │  (max 3 iterations total)        │
                                 │          │        │                                  │
              RSS/Atom feeds ────┘          │   6 critics in parallel            Neon Postgres
              Stooq quotes ─────────────────┘   (all must pass)              (issues, audit log,
                                             Claude via Vercel AI Gateway       source cache, holds)
```

**Ingest** fetches the feed list (`src/config/feeds.ts`) and the ticker watchlist
(`src/config/watchlist.ts`), caches every source, and keeps only fresh, in-window stories.
Fewer than 6 usable fresh stories → a flagged **short-form** issue (Ticker + Big Story +
Quick Hits only) instead of padding with thin content.

**Draft** asks Claude (via the Vercel AI Gateway, structured output + Zod) to write the
ten-section issue using **only** the ingested sources, citing each section's source URLs.

**The Gauntlet** runs six critics against the same draft, in parallel. A draft ships only
if **every** critic passes. Critics judge; they never rewrite — the drafter revises against
the *complete* violation list in one pass. One row per critic verdict per iteration is
written to the audit log.

| Critic | Type | Passes when |
|--------|------|-------------|
| **Fact** | Claude | Every company/number/%/$/date/quote maps to a cited source; no orphans, no mismatched figures. |
| **Freshness** | deterministic + archive | Every source in-window (≤36h; Big Story ≤72h only if developing); no stale repeats of the last 5 issues. |
| **Voice** | Claude | Morning-Brew fidelity ≥ 8/10 (contractions, quips, no jargon, short sentences, point-first). |
| **Structure** | deterministic | All sections present, in order, within word counts; subject ≤ 55 chars; Deal Flow bullets have numbers; Big Story has its "why it matters". |
| **Financial** | deterministic | Tickers valid and match the snapshot's top movers; dollar magnitudes sane. |
| **HTML** | deterministic + link checks | Self-contained, table layout, inline CSS, no `<script>`, 600px, dark-mode-legible, footer web link + issue number, links resolve. |

(Why some critics are deterministic rather than Claude calls, and other decisions, are in
[`ASSUMPTIONS.md`](./ASSUMPTIONS.md).)

**Output** is a single self-contained, email-safe HTML document per issue — table layout,
all CSS inline, no JavaScript, dark-mode-safe colors, alt text on images. Served at
`/issues/[date]`, `/issues/latest`, and raw at `/api/issues/[date]/html`.

---

## Stack

- **Next.js (App Router) + TypeScript strict**, on Vercel.
- **Vercel Cron** triggers the pipeline weekdays at 06:00 ET.
- **Claude via the Vercel AI Gateway** for drafting and the two model critics, with Zod
  structured outputs.
- **Neon Postgres** for the issue archive, source cache, and the Gauntlet audit log.

---

## Project layout

```
src/
  config/        brand, feeds, watchlist, editorial rules, pricing
  lib/           db (Neon), llm (AI Gateway + token ledger), logger, util
  ingest/        rss, quotes (Stooq), orchestrator
  draft/         Zod schema, drafter prompt, draft/revise
  gauntlet/      types, critics/{fact,freshness,voice,structure,financial,html}, aggregator, loop
  render/        email-safe HTML renderer + theme
  pipeline/      run.ts — the top-level daily pipeline
  app/           routes: /, /issues/[date], /issues/latest, /admin/holds,
                 /api/cron, /api/issues/[date]/html
db/migrations/   0001_init.sql
scripts/         migrate.ts, run-pipeline.ts
tests/           deterministic-critic + helper tests (vitest)
```

---

## Setup & deploy

### 1. Provision services
- **Neon**: create a project, copy the pooled connection string.
- **Vercel AI Gateway**: enable it; you'll get an `AI_GATEWAY_API_KEY` (or use Vercel OIDC).

### 2. Configure env
Copy `.env.example` → `.env.local` and fill in:

| Var | What |
|-----|------|
| `ANTHROPIC_API_KEY` | Preferred: direct Anthropic access (bypasses the Vercel AI Gateway and its card requirement). |
| `AI_GATEWAY_API_KEY` | Fallback: Claude via the Vercel AI Gateway, used only when `ANTHROPIC_API_KEY` is unset. |
| `MODEL_DRAFTER` / `MODEL_CRITIC` | Model id (default `claude-sonnet-4-5`). |
| `DATABASE_URL` | Neon pooled connection string. |
| `CRON_SECRET` | Guards `/api/cron` and `/admin/holds`. |
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL for the issue's web/archive links. |
| `PRICE_INPUT_PER_MTOK` / `PRICE_OUTPUT_PER_MTOK` | Your Gateway rates, for the cost estimate. |
| `AUTO_PUBLISH_ON_HOLD` | Opt-in, default off. Set to `1` to ship an issue even if the Gauntlet still fails after 3 iterations, instead of holding it for manual review. Deviates from the spec — see [`ASSUMPTIONS.md`](./ASSUMPTIONS.md). |

**Nothing secret goes in the repo or in the rendered HTML.** Set the same vars in Vercel
Project Settings for production.

### 3. Migrate the database
```bash
npm install
npm run migrate     # applies db/migrations/*.sql (idempotent)
```

### 4. Deploy
```bash
vercel deploy       # or connect the repo in the Vercel dashboard
```
`vercel.json` registers two weekday crons (10:00 and 11:00 UTC). The `/api/cron` handler
only proceeds when it's actually 06:00 in New York, so exactly one run fires per weekday
across EST/EDT (see [`ASSUMPTIONS.md`](./ASSUMPTIONS.md)). Cron requests carry
`Authorization: Bearer $CRON_SECRET` automatically.

### 5. Run it
```bash
npm run pipeline            # generate today's issue (skips if it already exists)
npm run pipeline -- --force # regenerate today's issue
```
Or trigger the deployed cron manually:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "$SITE/api/cron?force=1"
```

---

## Verifying the acceptance criteria

Everything below runs against your own Vercel/Neon/Gateway once the env is set.

1. **Full pipeline run + Gauntlet audit log.** `npm run pipeline` prints the run summary
   (status, iterations, per-stage token cost). Every critic verdict per iteration is in the
   `gauntlet_log` table:
   ```sql
   SELECT iteration, critic, pass, score FROM gauntlet_log
   WHERE issue_date = CURRENT_DATE ORDER BY iteration, critic;
   ```
2. **The Gauntlet rejects corrupted drafts.** The offline proof ships as tests —
   `tests/gauntlet-rejection.test.ts` injects a stale story, a fabricated/implausible stat,
   a bad ticker, and a numberless bullet, and asserts the deterministic critics **block the
   ship**. Run `npm test`. (In a live run the Fact and Voice critics add further coverage.)
3. **HTML renders correctly.** Open `/issues/latest` (web) or `/api/issues/[date]/html`
   (raw) and paste into Gmail web / a preview tool. The HTML critic already enforces the
   email-safety constraints on every ship.
4. **Cron dry-run.** `curl -H "Authorization: Bearer $CRON_SECRET" "$SITE/api/cron"` off-hour
   returns `{"skipped": true, ...}`; add `?force=1` to actually run. Vercel logs the
   scheduled invocations.
5. **Cost per issue.** Printed as `cost.usd` in the run summary and detailed in
   [`ASSUMPTIONS.md`](./ASSUMPTIONS.md).

---

## Development

```bash
npm run dev         # next dev
npm run typecheck   # tsc --noEmit
npm test            # vitest — deterministic critics + helpers (no secrets needed)
npm run build       # production build
```

The deterministic critics (Structure, Financial, HTML, Freshness) and all helpers are
unit-tested and run without any API keys or database. The two model critics (Fact, Voice)
and the drafter require the AI Gateway; the full pipeline requires Neon.

---

## Guardrails (enforced, not aspirational)

- Never fabricate sources, quotes, or numbers — the Fact critic maps every claim to a cited
  source and the drafter is instructed to cut unsupported claims.
- Paraphrase; no quote over 15 words; link out.
- Secrets live only in env vars — never in the repo or the HTML.
- Scope stays put: subscriber management, A/B testing, and analytics are logged in
  [`BACKLOG.md`](./BACKLOG.md), not built.
