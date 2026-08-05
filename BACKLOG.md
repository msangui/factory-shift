# Backlog

Ideas deliberately kept out of scope (spec: don't expand scope without instruction).
Logged here instead of built.

## Delivery
- **ESP integration** — send the generated HTML to subscribers (Resend / Postmark /
  SendGrid). The issue HTML and subject/preview are already produced and archived; this
  is a thin adapter over `getIssue(date)` at ship time.
- **Subscriber management** — signup, double opt-in, unsubscribe, list storage.

## Editorial quality
- **A/B subject testing** — the pipeline already logs both subject candidates; wire an
  ESP split test and feed open-rate back into subject selection.
- **Model-judged financial labeling** — a dedicated critic for revenue-vs-net-income and
  Q-vs-FY period correctness beyond the Fact critic's source check.
- **Smarter update detection** — replace exact-title dedup with a model judgment of
  whether a reappearing story carries a genuinely new development.
- **Per-source trust weighting** — learn feed reliability over time and rank candidates by it.

## Data
- **Intraday quotes** — swap Stooq EOD for a real-time source if the send moves earlier or
  needs pre-market moves.
- **More feeds / topic tuning** — expand `src/config/feeds.ts`; add earnings-calendar and
  SEC-filing ingestion for Deal Flow.
- **Full-article fetch** — pull article bodies (not just RSS snippets) to strengthen the
  Fact critic's evidence.

## Analytics & ops
- **Open/click analytics** — post-send engagement, stored per issue.
- **Cost dashboard** — chart the per-stage token ledger across issues.
- **Alerting on HOLD** — notify a human when an issue is held (Slack/email) so it can be
  reviewed and shipped manually the same morning.
- **Re-run/retry-from-hold UI** — a button on `/admin/holds` to re-run the pipeline with
  `?force=1` after fixing upstream.
