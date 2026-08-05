import { FRESHNESS, INGEST } from "@/config/rules";
import { upsertSources } from "@/lib/db";
import { log } from "@/lib/logger";
import { hoursBetween, normalizeTitle } from "@/lib/util";
import { fetchMarketSnapshot } from "@/ingest/quotes";
import { fetchAllFeeds } from "@/ingest/rss";
import type { CachedSource, IngestResult, StoryCandidate } from "@/ingest/types";

/**
 * Full ingestion for one run:
 *  1. Fetch every feed and persist ALL items to the source cache (so the Fact
 *     critic can later verify any cited URL was actually ingested).
 *  2. Build the candidate pool: items <= 72h old (the Big Story may use up to
 *     72h if developing; everything else is held to <=36h by the Freshness critic).
 *  3. Fetch the market snapshot.
 *  4. Decide short-form when fewer than the minimum usable fresh stories exist.
 *
 * `persist` is false in unit tests so no DB is required.
 */
export async function ingest(opts: { persist?: boolean } = {}): Promise<IngestResult> {
  const persist = opts.persist ?? true;
  const now = new Date();

  const [sources, market] = await Promise.all([fetchAllFeeds(), fetchMarketSnapshot()]);

  if (persist && sources.length > 0) {
    await upsertSources(sources);
  }

  const candidates = buildCandidates(sources, now);
  const usableFresh = candidates.filter((c) => c.ageHours <= FRESHNESS.maxAgeHours);
  const shortForm = usableFresh.length < INGEST.minStoriesForFullIssue;

  log.info("ingest.done", {
    fetched: sources.length,
    candidates: candidates.length,
    usableFresh: usableFresh.length,
    shortForm,
  });

  return { candidates, market, shortForm };
}

/** Dedupe within the pull, drop out-of-window items, rank, and cap. */
export function buildCandidates(sources: CachedSource[], now: Date): StoryCandidate[] {
  const byTitle = new Map<string, CachedSource>();
  for (const s of sources) {
    const ageHours = hoursBetween(s.publishedAt, now);
    if (ageHours < 0 || ageHours > FRESHNESS.bigStoryMaxAgeHours) continue; // out of window
    const key = normalizeTitle(s.title);
    if (!key) continue;
    const existing = byTitle.get(key);
    // Prefer the higher-weight, then fresher, copy of a story seen in multiple feeds.
    if (
      !existing ||
      s.feedWeight > existing.feedWeight ||
      (s.feedWeight === existing.feedWeight && s.publishedAt > existing.publishedAt)
    ) {
      byTitle.set(key, s);
    }
  }

  const candidates: StoryCandidate[] = [...byTitle.values()].map((s) => ({
    url: s.url,
    sourceName: s.sourceName,
    title: s.title,
    snippet: s.snippet,
    publishedAt: s.publishedAt.toISOString(),
    ageHours: Math.round(hoursBetween(s.publishedAt, now) * 10) / 10,
    feedWeight: s.feedWeight,
  }));

  candidates.sort((a, b) => b.feedWeight - a.feedWeight || a.ageHours - b.ageHours);
  return candidates.slice(0, INGEST.maxCandidateStories);
}
