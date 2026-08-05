import { factVerdictSchema } from "@/gauntlet/types";
import { type Critic, type GauntletContext, type Verdict } from "@/gauntlet/types";
import { findCachedByUrls } from "@/lib/db";
import { criticModel, generateStructured } from "@/lib/llm";
import { normalizeUrl } from "@/lib/util";

const FACT_SYSTEM = `You are the FACT CRITIC for a newsletter. You never rewrite the draft — you only judge it. Sources here are RSS SUMMARIES, so judge whether a claim's SUBSTANCE is supported by the provided evidence, not whether every word appears verbatim.

Your job: every named company, number, percentage, dollar figure, date, and quote in the draft must be supported by one of the PROVIDED SOURCES.

FAIL (add a violation) only when a claim is genuinely unsupported or contradicted:
- A specific figure (number, %, $) that does NOT appear in, and cannot be derived from, any provided source — i.e. it looks fabricated.
- A number that CONTRADICTS its source: wrong magnitude/units ($B vs $M), or wrong period (Q vs FY, YoY vs QoQ).
- A company or event that no provided source mentions at all.
- A quote not present in the source, or longer than 15 words.
- A section that cites a URL not in the provided evidence list.

Do NOT fail a claim just because the summary is terse: if the source clearly supports the gist, it passes. Optionally fill the 'claims' table with only the riskiest claims you checked.

Score 10 for a clean pass; lower as real violations mount. For each violation, give a precise location (e.g. 'bigStory.body'), the problem, and a concrete fix.`;

/** Gather the snippets for every URL the draft cites, from the pool and (live) the DB. */
async function gatherEvidence(ctx: GauntletContext): Promise<{ url: string; title: string; snippet: string }[]> {
  const cited = new Set<string>();
  const add = (u: string) => cited.add(normalizeUrl(u));
  const d = ctx.draft;
  d.bigStory?.sourceUrls.forEach(add);
  d.retailTech?.sourceUrls.forEach(add);
  d.cpgCorner?.sourceUrls.forEach(add);
  d.dealFlow?.forEach((b) => add(b.sourceUrl));
  d.quickHits.forEach((h) => add(h.sourceUrl));
  if (d.statOfDay) add(d.statOfDay.sourceUrl);

  const evidence = new Map<string, { url: string; title: string; snippet: string }>();
  for (const c of ctx.ingest.candidates) {
    const n = normalizeUrl(c.url);
    if (cited.has(n)) evidence.set(n, { url: c.url, title: c.title, snippet: c.snippet });
  }
  if (ctx.live) {
    const missing = [...cited].filter((n) => !evidence.has(n));
    if (missing.length > 0) {
      const rows = await findCachedByUrls(missing);
      for (const [n, r] of rows) evidence.set(n, { url: r.url, title: r.title, snippet: r.snippet });
    }
  }
  return [...evidence.values()];
}

function draftForReview(d: GauntletContext["draft"]): string {
  const parts: string[] = [];
  parts.push(`Opening: ${d.openingLine}`);
  d.ticker.moverNotes.forEach((m) => parts.push(`Ticker note (${m.symbol}): ${m.why}`));
  if (d.bigStory) parts.push(`Big Story "${d.bigStory.title}" [${d.bigStory.sourceUrls.join(", ")}]: ${d.bigStory.body} Why it matters: ${d.bigStory.whyItMatters}`);
  if (d.retailTech) parts.push(`Retail Tech "${d.retailTech.title}" [${d.retailTech.sourceUrls.join(", ")}]: ${d.retailTech.body}`);
  if (d.cpgCorner) parts.push(`CPG Corner "${d.cpgCorner.title}" [${d.cpgCorner.sourceUrls.join(", ")}]: ${d.cpgCorner.body}`);
  d.dealFlow?.forEach((b, i) => parts.push(`Deal Flow ${i} [${b.sourceUrl}]: ${b.text}`));
  d.quickHits.forEach((h, i) => parts.push(`Quick Hit ${i} [${h.sourceUrl}]: ${h.text}`));
  if (d.statOfDay) parts.push(`Stat [${d.statOfDay.sourceUrl}]: ${d.statOfDay.stat} — ${d.statOfDay.context}`);
  return parts.join("\n");
}

/**
 * Fact critic (Claude call, pass = zero violations).
 * Deterministically flags any cited URL absent from the evidence bank as an
 * orphan, then hands the draft + evidence to Claude to verify each claim.
 */
export const factCritic: Critic = {
  name: "fact",
  async run(ctx: GauntletContext): Promise<Verdict> {
    const evidence = await gatherEvidence(ctx);
    const evidenceNorms = new Set(evidence.map((e) => normalizeUrl(e.url)));

    // Deterministic orphan-source check (belt and suspenders).
    const orphanViolations = [];
    for (const s of citedBySection(ctx.draft)) {
      for (const url of s.urls) {
        if (!evidenceNorms.has(normalizeUrl(url))) {
          orphanViolations.push({
            location: s.key,
            issue: `Cited source is not in the ingested source cache: ${url}`,
            fix_suggestion: "Only cite URLs from the provided candidate sources.",
          });
        }
      }
    }

    const prompt = `EVIDENCE (the only sources that may support any claim):
${evidence.map((e) => `- ${e.url}\n  title: ${e.title}\n  snippet: ${e.snippet}`).join("\n") || "(no evidence provided)"}

DRAFT TO VERIFY:
${draftForReview(ctx.draft)}

Produce the claims table and the verdict.`;

    const verdict = await generateStructured({
      schema: factVerdictSchema,
      system: FACT_SYSTEM,
      prompt,
      model: criticModel(),
      stage: "critic:fact",
      maxOutputTokens: 4096,
    });

    // Merge deterministic orphans + any unsupported claims the model listed.
    const merged = [...orphanViolations, ...verdict.violations];
    for (const c of verdict.claims ?? []) {
      if (!c.supported && !merged.some((m) => m.issue.includes(c.claim.slice(0, 24)))) {
        merged.push({ location: "claim", issue: `Unsupported claim: ${c.claim}`, fix_suggestion: "Remove it or cite a supporting source." });
      }
    }

    return { pass: merged.length === 0, score: merged.length === 0 ? verdict.score : Math.min(verdict.score, 5), violations: merged };
  },
};

function citedBySection(d: GauntletContext["draft"]): { key: string; urls: string[] }[] {
  const out: { key: string; urls: string[] }[] = [];
  if (d.bigStory) out.push({ key: "bigStory", urls: d.bigStory.sourceUrls });
  if (d.retailTech) out.push({ key: "retailTech", urls: d.retailTech.sourceUrls });
  if (d.cpgCorner) out.push({ key: "cpgCorner", urls: d.cpgCorner.sourceUrls });
  if (d.dealFlow) d.dealFlow.forEach((b, i) => out.push({ key: `dealFlow[${i}]`, urls: [b.sourceUrl] }));
  d.quickHits.forEach((h, i) => out.push({ key: `quickHits[${i}]`, urls: [h.sourceUrl] }));
  if (d.statOfDay) out.push({ key: "statOfDay", urls: [d.statOfDay.sourceUrl] });
  return out;
}
