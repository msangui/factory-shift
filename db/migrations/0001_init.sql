-- The Morning Shelf — initial schema.
-- Apply with: npm run migrate  (idempotent; safe to re-run).

CREATE TABLE IF NOT EXISTS source_cache (
  id            BIGSERIAL PRIMARY KEY,
  url           TEXT NOT NULL,
  url_norm      TEXT NOT NULL UNIQUE,
  source_name   TEXT NOT NULL,
  title         TEXT NOT NULL,
  title_norm    TEXT NOT NULL,
  snippet       TEXT NOT NULL DEFAULT '',
  published_at  TIMESTAMPTZ NOT NULL,
  fetched_at    TIMESTAMPTZ NOT NULL,
  feed_weight   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS source_cache_published_idx ON source_cache (published_at DESC);
CREATE INDEX IF NOT EXISTS source_cache_title_norm_idx ON source_cache (title_norm);

CREATE TABLE IF NOT EXISTS issues (
  issue_date     DATE PRIMARY KEY,
  issue_number   INTEGER NOT NULL UNIQUE,
  status         TEXT NOT NULL,               -- shipped | short_form_shipped | held
  subject        TEXT NOT NULL,
  preview_text   TEXT NOT NULL DEFAULT '',
  is_short_form  BOOLEAN NOT NULL DEFAULT FALSE,
  iterations     INTEGER NOT NULL DEFAULT 0,
  word_count     INTEGER NOT NULL DEFAULT 0,
  body           JSONB NOT NULL,
  html           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shipped_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS issues_status_idx ON issues (status, issue_date DESC);

-- One row per critic verdict per iteration (the Gauntlet audit log).
CREATE TABLE IF NOT EXISTS gauntlet_log (
  id          BIGSERIAL PRIMARY KEY,
  issue_date  DATE NOT NULL,
  iteration   INTEGER NOT NULL,
  critic      TEXT NOT NULL,
  pass        BOOLEAN NOT NULL,
  score       NUMERIC NOT NULL,
  violations  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gauntlet_log_issue_idx ON gauntlet_log (issue_date, iteration);

CREATE TABLE IF NOT EXISTS holds (
  issue_date             DATE PRIMARY KEY,
  failing_critics        JSONB NOT NULL DEFAULT '[]'::jsonb,
  unresolved_violations  JSONB NOT NULL DEFAULT '[]'::jsonb,
  drafts                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
