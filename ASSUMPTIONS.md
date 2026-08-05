# Assumptions Ledger

Every call the spec didn't cover, appended here rather than buried in code comments.
Format: `date · assumption · rationale · revisit_trigger`.

| Date | Assumption | Rationale | Revisit trigger |
|------|------------|-----------|-----------------|
| 2026-08-05 | **Name is "The Morning Shelf".** Three alternatives were proposed per spec — *Aisle & Ledger* (working name), *Checkout*, *Shelf Life* — and the operator chose "The Morning Shelf" (also the repo name). | Spec requires proposing 3 names before first deploy; the operator picked their own. | Rebrand: change `BRAND.name` in `src/config/brand.ts`. |
| 2026-08-05 | **Claude is reached via the Vercel AI SDK (`ai`) using bare `provider/model` slugs routed through the AI Gateway**, not the Anthropic SDK directly. Structured outputs use `generateObject` with Zod schemas. | Spec locks "Claude via Vercel AI Gateway" + "structured outputs with Zod schemas" — that is the AI SDK's idiom, and the gateway is the single egress point. | Switch to a different gateway/provider path, or if the AI SDK's gateway routing changes. |
| 2026-08-05 | **Default model `claude-sonnet-4-5`**, overridable via `MODEL_DRAFTER` / `MODEL_CRITIC`. | Cost/quality balance for daily drafting + judging; kept out of code so it can be pinned per-deploy. | Pin a specific Claude model. |
| 2026-08-05 | **Direct Anthropic API is now the preferred LLM path**, chosen automatically when `ANTHROPIC_API_KEY` is set; the Vercel AI Gateway is the fallback when it isn't. This deviates from the spec's locked "Claude via Vercel AI Gateway". | The Vercel AI Gateway refuses to service *any* request (even free-tier) without a credit card on file (`customer_verification_required` 403). The operator preferred using their own Anthropic key over adding a card. The Gateway path is preserved as a fallback, so the locked decision still works for anyone who adds a card. | Operator adds a card and wants Gateway-only; unset `ANTHROPIC_API_KEY` to route through the Gateway. |
| 2026-08-05 | **Hybrid critics.** Fact and Voice are Claude calls; Freshness, Structure, Financial, and HTML are deterministic (Freshness also queries the archive). | Word-counting, ticker/snapshot matching, HTML validation, and timestamp checks are more trustworthy and cheaper in code than in a model call — and "a boring true issue beats an invented one." Every critic still returns the same `{pass, score, violations}` verdict and is logged per iteration. | Editorial wants model-judged structure/financial nuance. |
| 2026-08-05 | **Earnings metric/period labeling (revenue vs net income, Q vs FY, YoY vs QoQ) is verified by the Fact critic (Claude, against sources)**, not the deterministic Financial critic. | Period/metric correctness needs the source text; the deterministic Financial critic covers tickers, snapshot consistency, and dollar-magnitude sanity. | If period/metric errors slip through, add a dedicated financial-labeling model check. |
| 2026-08-05 | **Cross-issue duplicate detection uses an exact normalized-title match against the last 5 issues.** The "genuinely new development, framed as an update" nuance is otherwise left to editorial. | Detecting *stale repetition* deterministically is reliable; judging whether a reappearance is a legitimate update is fuzzy and risks false holds. | False holds on legitimate updates, or stale repeats slipping through. |
| 2026-08-05 | **Quotes come from Stooq** (free, keyless, end-of-day) via a bounded daily-history CSV; % change is computed from the last two closes. | Spec asks for a "free quotes API"; Stooq needs no key and gives previous close + change without rate-limit friction. EOD data suits a 6am send (prior trading-day close). | Need intraday/real-time data, or Stooq becomes unreliable — swap the provider in `src/ingest/quotes.ts`. |
| 2026-08-05 | **Cron DST handling: two weekday UTC crons (10:00 and 11:00) + an ET-hour gate in the handler** → exactly one 06:00-ET run year-round. | Vercel Cron is UTC-only with no timezone support; 06:00 ET is 10:00 UTC in EDT and 11:00 UTC in EST. The handler only proceeds when it is actually 6am in New York. | Vercel plan limits cron count, or the send time changes — edit `vercel.json` + `TARGET_HOUR_ET`. |
| 2026-08-05 | **Dark-mode + all-inline-CSS resolved with a single committed palette** (explicit backgrounds on every container, mid-contrast text, visible borders), not a `<style>` `prefers-color-scheme` block. | The HTML critic forbids `<style>` (CSS must be inline), and email dark-mode support is uneven and often force-inverts. A palette that survives inversion is the robust compromise. | A client needs true `prefers-color-scheme` theming. |
| 2026-08-05 | **HTML link HEAD-check treats bot-blocking responses (401/403/405/429) as "resolves".** Only 404/410/gone and network failures/timeouts are violations. | News publishers routinely block bot HEAD requests; a working true issue should not be HELD because a server returned 403 to our user-agent. | Broken (404) links slip through, or a stricter link policy is wanted. |
| 2026-08-05 | **Per-issue cost uses placeholder pricing** (`PRICE_INPUT_PER_MTOK=3`, `PRICE_OUTPUT_PER_MTOK=15`) in `src/config/pricing.ts`. | Real Gateway pricing depends on the model and plan; the pipeline logs actual per-stage token counts so the estimate is grounded once rates are set. | Set the two `PRICE_*` env vars to your Gateway's actual rates. |
| 2026-08-05 | **Idempotent per date.** The pipeline skips if today's issue row already exists; `--force` / `?force=1` regenerates. | The double cron (DST) and any manual retry must not produce duplicate issues. | — |
| 2026-08-05 | **Held issues are also written to `issues` with status `held`** (not just to `holds`), so they can be previewed and shipped manually. `getLatestIssue()` returns only shipped/short-form issues, so a held issue never surfaces as "latest". | Spec: a held issue may ship manually after human review — it needs to be retrievable and renderable. | — |
| 2026-08-05 | **Email delivery (ESP send) is out of scope.** The system generates, validates, archives, and serves issues; it does not send them to subscribers. | Spec explicitly excludes subscriber management; delivery is logged to `BACKLOG.md`. | Wire an ESP (see BACKLOG). |

---

## Per-issue cost estimate (acceptance criterion #5)

The pipeline accumulates token usage per stage (`TokenLedger`) and prints it in the
run summary (`cost.perStage`, `cost.usd`). Deterministic critics (Structure, Financial,
HTML, Freshness) cost **zero tokens**. Only three stages call the model: `draft`,
`critic:fact`, `critic:voice`, and `revise` (on a failed iteration).

**Illustrative estimate** (model at $3 / $15 per 1M input/output tokens; ~1.5 Gauntlet
iterations average):

| Stage | Calls | ~Input tok | ~Output tok |
|-------|-------|-----------:|------------:|
| draft | 1 | 5,000 | 2,000 |
| critic:fact | ~2 | 6,000 | 2,000 |
| critic:voice | ~2 | 3,600 | 1,600 |
| revise | ~1 | 6,000 | 2,000 |
| **Total** | | **~20,600** | **~7,600** |

Estimated cost ≈ (20,600 / 1e6 × \$3) + (7,600 / 1e6 × \$15) ≈ **\$0.06 + \$0.11 ≈ \$0.18 per issue**.

Range in practice: **~\$0.12 (clean first pass) to ~\$0.30 (three iterations)**. Replace the
`PRICE_*` env vars with your model's real Gateway rates; the printed `cost.usd` will then be exact.
