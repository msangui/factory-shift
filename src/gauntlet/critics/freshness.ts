import { FRESHNESS } from "@/config/rules";
import { findCachedByUrls, recentIssueSourceUrls, recentIssueTitles } from "@/lib/db";
import { hoursBetween, normalizeTitle, normalizeUrl } from "@/lib/util";
import { type Critic, type GauntletContext, type Verdict, type Violation } from "@/gauntlet/types";

/**
 * Freshness critic (deterministic + archive lookup, pass = zero violations).
 * Every story timestamp is within the window (<=36h; the Big Story may reach
 * 72h only if developing=true). Duplicate detection is two-layered — this is
 * mostly a safety net, since ingest already excludes previously-used URLs and
 * titles from the candidate pool before the drafter ever sees them:
 *  - a cited source URL already used in the last 5 issues, in ANY section
 *    (Big Story, Retail Tech, CPG Corner, Deal Flow, Quick Hits, Stat of the
 *    Day) is flagged, since a repeated URL is an unambiguous repeat regardless
 *    of rewording;
 *  - a headline (Big Story/Retail Tech/CPG Corner, the only sections with a
 *    "title") that exactly matches one from the last 5 issues is flagged too,
 *    catching the case where a different outlet re-covers the same event
 *    under a new URL.
 *
 * Ages come from the ingest candidate pool (no DB needed for the timestamp
 * check); when `ctx.live`, uncached-but-cited URLs are resolved against the DB,
 * and the archive is queried for the duplicate check.
 */
export const freshnessCritic: Critic = {
  name: "freshness",
  async run(ctx: GauntletContext): Promise<Verdict> {
    const v: Violation[] = [];
    const now = new Date();

    const ageByUrl = new Map<string, number>();
    for (const c of ctx.ingest.candidates) ageByUrl.set(normalizeUrl(c.url), c.ageHours);

    // Resolve any cited URLs missing from the pool via the DB when live.
    const sections = sectionSources(ctx.draft);
    if (ctx.live) {
      const missing = sections
        .flatMap((s) => s.urls)
        .map(normalizeUrl)
        .filter((u) => !ageByUrl.has(u));
      if (missing.length > 0) {
        const cached = await findCachedByUrls([...new Set(missing)]);
        for (const [norm, row] of cached) {
          ageByUrl.set(norm, hoursBetween(new Date(row.published_at), now));
        }
      }
    }

    for (const s of sections) {
      const allowed = s.key === "bigStory" && ctx.draft.bigStory?.developing ? FRESHNESS.bigStoryMaxAgeHours : FRESHNESS.maxAgeHours;
      for (const url of s.urls) {
        const age = ageByUrl.get(normalizeUrl(url));
        if (age === undefined) {
          v.push({ location: s.key, issue: `Cited source is not in the ingest window/cache, so freshness can't be verified: ${url}`, fix_suggestion: "Use a source from today's candidate list." });
        } else if (age > allowed) {
          v.push({ location: s.key, issue: `Source is ${Math.round(age)}h old; max for ${s.key} is ${allowed}h.`, fix_suggestion: s.key === "bigStory" ? "Use a fresher source or set developing=true if it truly is." : "Use a source <=36h old." });
        }
      }
    }

    // Duplicate detection vs the last N issues.
    if (ctx.live) {
      const [recentTitleSet, recentUrlSet] = await Promise.all([
        recentIssueTitles(FRESHNESS.dedupeLookbackIssues).then((t) => new Set(t)),
        recentIssueSourceUrls(FRESHNESS.dedupeLookbackIssues),
      ]);
      for (const [key, title] of currentTitles(ctx.draft)) {
        if (recentTitleSet.has(normalizeTitle(title))) {
          v.push({ location: key, issue: `"${title}" ran in a recent issue.`, fix_suggestion: "Drop it, or only reuse it with a genuinely new development framed explicitly as an update." });
        }
      }
      for (const s of sections) {
        for (const url of s.urls) {
          if (recentUrlSet.has(normalizeUrl(url))) {
            v.push({ location: s.key, issue: `Source ${url} was already cited in a recent issue — this is a repeat story.`, fix_suggestion: "Use a different, not-yet-covered source, or drop this item." });
          }
        }
      }
    }

    const score = v.length === 0 ? 10 : Math.max(0, 10 - v.length);
    return { pass: v.length === 0, score, violations: v };
  },
};

function sectionSources(d: GauntletContext["draft"]): { key: string; urls: string[] }[] {
  const out: { key: string; urls: string[] }[] = [];
  if (d.bigStory) out.push({ key: "bigStory", urls: d.bigStory.sourceUrls });
  if (d.retailTech) out.push({ key: "retailTech", urls: d.retailTech.sourceUrls });
  if (d.cpgCorner) out.push({ key: "cpgCorner", urls: d.cpgCorner.sourceUrls });
  if (d.dealFlow) d.dealFlow.forEach((b, i) => out.push({ key: `dealFlow[${i}]`, urls: [b.sourceUrl] }));
  d.quickHits.forEach((h, i) => out.push({ key: `quickHits[${i}]`, urls: [h.sourceUrl] }));
  if (d.statOfDay) out.push({ key: "statOfDay", urls: [d.statOfDay.sourceUrl] });
  return out;
}

function currentTitles(d: GauntletContext["draft"]): [string, string][] {
  const out: [string, string][] = [];
  if (d.bigStory) out.push(["bigStory", d.bigStory.title]);
  if (d.retailTech) out.push(["retailTech", d.retailTech.title]);
  if (d.cpgCorner) out.push(["cpgCorner", d.cpgCorner.title]);
  return out;
}
