import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { IssueDraft } from "@/draft/schema";
import type { CriticName, Verdict } from "@/gauntlet/types";
import type { CachedSource } from "@/ingest/types";
import { normalizeTitle, normalizeUrl } from "@/lib/util";

let _sql: NeonQueryFunction<false, false> | null = null;

/** Lazily create the Neon client so importing this module never requires env. */
export function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.",
    );
  }
  _sql = neon(url);
  return _sql;
}

// ── Issue status ────────────────────────────────────────────────────────────
export type IssueStatus = "shipped" | "held" | "short_form_shipped";

export interface IssueRow {
  issue_date: string;
  issue_number: number;
  status: IssueStatus;
  subject: string;
  preview_text: string;
  is_short_form: boolean;
  iterations: number;
  word_count: number;
  body: IssueDraft;
  html: string;
  created_at: string;
  shipped_at: string | null;
}

export interface HoldRow {
  issue_date: string;
  failing_critics: CriticName[];
  unresolved_violations: unknown;
  drafts: IssueDraft[];
  /** Rendered HTML of the held (final) draft; empty on pre-0002 rows. */
  html: string;
  /** The final held draft; null on pre-0002 rows. */
  final_draft: IssueDraft | null;
  created_at: string;
}

// ── Source cache ─────────────────────────────────────────────────────────────

/** Insert fetched sources, skipping URLs already cached (idempotent per URL). */
export async function upsertSources(sources: CachedSource[]): Promise<void> {
  if (sources.length === 0) return;
  const sql = getSql();
  for (const s of sources) {
    await sql`
      INSERT INTO source_cache
        (url, url_norm, source_name, title, title_norm, snippet, published_at, fetched_at, feed_weight)
      VALUES
        (${s.url}, ${normalizeUrl(s.url)}, ${s.sourceName}, ${s.title},
         ${normalizeTitle(s.title)}, ${s.snippet}, ${s.publishedAt.toISOString()},
         ${s.fetchedAt.toISOString()}, ${s.feedWeight})
      ON CONFLICT (url_norm) DO UPDATE
        SET title = EXCLUDED.title,
            snippet = EXCLUDED.snippet,
            published_at = EXCLUDED.published_at,
            fetched_at = EXCLUDED.fetched_at
    `;
  }
}

/**
 * Look up which of the given normalized URLs exist in the source cache. Used by
 * the Fact critic to prove every cited URL was actually ingested.
 */
export async function findCachedByUrls(urlNorms: string[]): Promise<Map<string, CachedSourceRow>> {
  const map = new Map<string, CachedSourceRow>();
  if (urlNorms.length === 0) return map;
  const sql = getSql();
  const rows = (await sql`
    SELECT url, url_norm, source_name, title, snippet, published_at
    FROM source_cache
    WHERE url_norm = ANY(${urlNorms})
  `) as CachedSourceRow[];
  for (const r of rows) map.set(r.url_norm, r);
  return map;
}

export interface CachedSourceRow {
  url: string;
  url_norm: string;
  source_name: string;
  title: string;
  snippet: string;
  published_at: string;
}

// ── Issues ───────────────────────────────────────────────────────────────────

// The DATE column comes back from the driver as a JS Date; cast to text so the
// UI receives a plain 'YYYY-MM-DD' string (rendering a Date as a React child throws).
export async function getIssue(date: string): Promise<IssueRow | null> {
  const sql = getSql();
  const rows = (await sql`SELECT issue_date::text AS issue_date, issue_number, status, subject,
    preview_text, is_short_form, iterations, word_count, body, html, created_at, shipped_at
    FROM issues WHERE issue_date = ${date}`) as IssueRow[];
  return rows[0] ?? null;
}

export async function getLatestIssue(): Promise<IssueRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT issue_date::text AS issue_date, issue_number, status, subject, preview_text,
           is_short_form, iterations, word_count, body, html, created_at, shipped_at
    FROM issues
    WHERE status IN ('shipped', 'short_form_shipped')
    ORDER BY issue_date DESC
    LIMIT 1
  `) as IssueRow[];
  return rows[0] ?? null;
}

export async function listIssues(limit = 30): Promise<IssueRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT issue_date::text AS issue_date, issue_number, status, subject, preview_text,
           is_short_form, iterations, word_count, body, html, created_at, shipped_at
    FROM issues
    WHERE status IN ('shipped', 'short_form_shipped')
    ORDER BY issue_date DESC
    LIMIT ${limit}
  `) as IssueRow[];
}

/** The next issue number = (max shipped number) + 1, starting at 1. */
export async function nextIssueNumber(): Promise<number> {
  const sql = getSql();
  const rows = (await sql`SELECT COALESCE(MAX(issue_number), 0) AS n FROM issues`) as { n: number }[];
  return (rows[0]?.n ?? 0) + 1;
}

export async function saveIssue(row: {
  issueDate: string;
  issueNumber: number;
  status: IssueStatus;
  subject: string;
  previewText: string;
  isShortForm: boolean;
  iterations: number;
  wordCount: number;
  body: IssueDraft;
  html: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO issues
      (issue_date, issue_number, status, subject, preview_text, is_short_form,
       iterations, word_count, body, html, shipped_at)
    VALUES
      (${row.issueDate}, ${row.issueNumber}, ${row.status}, ${row.subject},
       ${row.previewText}, ${row.isShortForm}, ${row.iterations}, ${row.wordCount},
       ${JSON.stringify(row.body)}::jsonb, ${row.html}, NOW())
    ON CONFLICT (issue_date) DO UPDATE
      SET status = EXCLUDED.status,
          subject = EXCLUDED.subject,
          preview_text = EXCLUDED.preview_text,
          is_short_form = EXCLUDED.is_short_form,
          iterations = EXCLUDED.iterations,
          word_count = EXCLUDED.word_count,
          body = EXCLUDED.body,
          html = EXCLUDED.html,
          shipped_at = NOW()
  `;
}

/** Recent issue titles (per section) for cross-issue duplicate detection. */
export async function recentIssueTitles(lookback: number): Promise<string[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT body FROM issues
    ORDER BY issue_date DESC
    LIMIT ${lookback}
  `) as { body: IssueDraft }[];
  const titles: string[] = [];
  for (const r of rows) {
    const b = r.body;
    if (b.bigStory) titles.push(b.bigStory.title);
    if (b.retailTech) titles.push(b.retailTech.title);
    if (b.cpgCorner) titles.push(b.cpgCorner.title);
  }
  return titles.map(normalizeTitle);
}

/**
 * Every source URL cited anywhere (Big Story, Retail Tech, CPG Corner, Deal
 * Flow bullets, Quick Hits, Stat of the Day) in the last N issues, normalized.
 * A URL already cited is an unambiguous repeat regardless of how its headline
 * gets reworded — this is the primary cross-issue duplicate signal, and it
 * covers every section (unlike title matching, which only applies to the
 * three sections that have a "title" field).
 */
export async function recentIssueSourceUrls(lookback: number): Promise<Set<string>> {
  const sql = getSql();
  const rows = (await sql`
    SELECT body FROM issues
    ORDER BY issue_date DESC
    LIMIT ${lookback}
  `) as { body: IssueDraft }[];
  const urls = new Set<string>();
  for (const r of rows) {
    const b = r.body;
    if (b.bigStory) b.bigStory.sourceUrls.forEach((u) => urls.add(normalizeUrl(u)));
    if (b.retailTech) b.retailTech.sourceUrls.forEach((u) => urls.add(normalizeUrl(u)));
    if (b.cpgCorner) b.cpgCorner.sourceUrls.forEach((u) => urls.add(normalizeUrl(u)));
    if (b.dealFlow) b.dealFlow.forEach((d) => urls.add(normalizeUrl(d.sourceUrl)));
    b.quickHits.forEach((q) => urls.add(normalizeUrl(q.sourceUrl)));
    if (b.statOfDay) urls.add(normalizeUrl(b.statOfDay.sourceUrl));
  }
  return urls;
}

// ── Gauntlet audit log ───────────────────────────────────────────────────────

/** One row per critic verdict per iteration (the audit log). */
export async function logVerdict(
  issueDate: string,
  iteration: number,
  critic: CriticName,
  verdict: Verdict,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO gauntlet_log (issue_date, iteration, critic, pass, score, violations)
    VALUES (${issueDate}, ${iteration}, ${critic}, ${verdict.pass}, ${verdict.score},
            ${JSON.stringify(verdict.violations)}::jsonb)
  `;
}

export async function getAuditLog(issueDate: string): Promise<GauntletLogRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT * FROM gauntlet_log
    WHERE issue_date = ${issueDate}
    ORDER BY iteration ASC, critic ASC
  `) as GauntletLogRow[];
}

export interface GauntletLogRow {
  id: number;
  issue_date: string;
  iteration: number;
  critic: CriticName;
  pass: boolean;
  score: number;
  violations: unknown;
  created_at: string;
}

// ── Holds ────────────────────────────────────────────────────────────────────

export async function saveHold(
  issueDate: string,
  failingCritics: CriticName[],
  unresolvedViolations: unknown,
  drafts: IssueDraft[],
  html: string,
  finalDraft: IssueDraft,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO holds (issue_date, failing_critics, unresolved_violations, drafts, html, final_draft)
    VALUES (${issueDate}, ${JSON.stringify(failingCritics)}::jsonb,
            ${JSON.stringify(unresolvedViolations)}::jsonb, ${JSON.stringify(drafts)}::jsonb,
            ${html}, ${JSON.stringify(finalDraft)}::jsonb)
    ON CONFLICT (issue_date) DO UPDATE
      SET failing_critics = EXCLUDED.failing_critics,
          unresolved_violations = EXCLUDED.unresolved_violations,
          drafts = EXCLUDED.drafts,
          html = EXCLUDED.html,
          final_draft = EXCLUDED.final_draft,
          created_at = NOW()
  `;
}

export async function getHold(date: string): Promise<HoldRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT issue_date::text AS issue_date, failing_critics, unresolved_violations, drafts,
           html, final_draft, created_at
    FROM holds WHERE issue_date = ${date}
  `) as HoldRow[];
  return rows[0] ?? null;
}

export async function listHolds(): Promise<HoldRow[]> {
  const sql = getSql();
  return (await sql`
    SELECT issue_date::text AS issue_date, failing_critics, unresolved_violations, drafts,
           html, final_draft, created_at
    FROM holds ORDER BY issue_date DESC
  `) as HoldRow[];
}

/**
 * Manually ship a held issue after human review (spec: "may ship manually").
 * Two cases:
 *  1. The issues row itself is 'held' → flip it to shipped.
 *  2. The issues row stayed shipped (a force re-run held, so the new draft was
 *     stashed on the holds row instead of demoting the live issue) → apply the
 *     held draft + HTML to the issues row.
 * The hold record is cleared on success. Returns the new status, or null if
 * there was nothing to ship for that date.
 */
export async function shipHeldIssue(date: string): Promise<IssueStatus | null> {
  const sql = getSql();

  // Case 1: the issue row is held.
  const flipped = (await sql`
    UPDATE issues
    SET status = CASE WHEN is_short_form THEN 'short_form_shipped' ELSE 'shipped' END,
        shipped_at = NOW()
    WHERE issue_date = ${date} AND status = 'held'
    RETURNING status
  `) as { status: IssueStatus }[];
  if (flipped[0]) {
    await sql`DELETE FROM holds WHERE issue_date = ${date}`;
    return flipped[0].status;
  }

  // Case 2: a stashed held draft behind a still-live issue.
  const hold = await getHold(date);
  if (!hold || !hold.html || !hold.final_draft) return null;
  const d = hold.final_draft;
  const subject = d.subjectCandidates[d.chosenSubjectIndex] ?? d.subjectCandidates[0] ?? "The Morning Shelf";
  const status: IssueStatus = d.isShortForm ? "short_form_shipped" : "shipped";
  const updated = (await sql`
    UPDATE issues
    SET body = ${JSON.stringify(d)}::jsonb,
        html = ${hold.html},
        subject = ${subject},
        preview_text = ${d.previewText},
        is_short_form = ${d.isShortForm},
        status = ${status},
        shipped_at = NOW()
    WHERE issue_date = ${date}
    RETURNING status
  `) as { status: IssueStatus }[];
  if (!updated[0]) return null;
  await sql`DELETE FROM holds WHERE issue_date = ${date}`;
  return updated[0].status;
}
