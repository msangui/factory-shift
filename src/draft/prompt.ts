import { BRAND } from "@/config/brand";
import { LENGTHS } from "@/config/rules";
import type { IngestResult, MarketSnapshot, StoryCandidate } from "@/ingest/types";
import type { Violation } from "@/gauntlet/types";

export const DRAFTER_SYSTEM = `You are the writer for "${BRAND.name}", a daily Retail & CPG newsletter with a hard editorial bias toward TECHNOLOGY and FINANCIAL news (earnings, M&A, capital allocation, retail media, supply-chain tech, AI adoption, commerce platforms, pricing/elasticity, margins).

VOICE — Morning Brew. You are a smart friend explaining business news over coffee. Punchy sentences. Numbers-forward. Wit without cringe. Zero corporate jargon. Every section skimmable in seconds. Use contractions. Lead every section with the point, not the setup. Never use "synergies", "leverage" as a verb, or "ecosystem". Keep sentences averaging 18 words or fewer.

GROUND TRUTH — This is absolute. Every named company, number, percentage, dollar figure, date, and quote MUST come from the provided sources. Never introduce a fact that is not in a source. For every section you write, list the exact source URLs (from the provided list) that its facts trace to. If you cannot support a claim with a provided source, cut the claim.

COPYRIGHT — Paraphrase everything. No quote longer than 15 words; at most one short quote per source.

STRUCTURE — Produce all sections in the schema, in order:
1. Two subject-line candidates, each <= ${LENGTHS.subjectMaxChars} characters, plus preview text.
2. Opening line — one witty sentence tied to the day's lead.
3. The Ticker — provide a one-line "why" for each of the top 3 movers (given to you). Do NOT write any price or percentage yourself; the system inserts the real numbers. Just explain the move in a clause.
4. Big Story — ${LENGTHS.bigStoryWords.min}–${LENGTHS.bigStoryWords.max} words, one lead story (tech or financial), ending with a "why it matters" line. Set developing=true ONLY if it is a genuinely developing multi-day story.
5. Retail Tech — ${LENGTHS.retailTechWords.min}–${LENGTHS.retailTechWords.max} words on commerce tech, AI, retail media, or supply-chain systems.
6. CPG Corner — ${LENGTHS.cpgCornerWords.min}–${LENGTHS.cpgCornerWords.max} words on a CPG player: earnings, pricing, portfolio, or DTC.
7. Deal Flow & Earnings — ${LENGTHS.dealFlowBullets.min}–${LENGTHS.dealFlowBullets.max} bullets, each <= ${LENGTHS.dealFlowWordsPerBullet.max} words, each with a HARD NUMBER.
8. Quick Hits — ${LENGTHS.quickHits.min}–${LENGTHS.quickHits.max} one-liners, mixed retail/CPG.
9. Stat of the Day — one number, one sentence of context.
10. Sign-off — one line of personality (the system appends the issue number and archive link).

LENGTH — 600–900 words of body copy total; never exceed 1000.

FRESHNESS — Only the Big Story may use a source up to 72h old, and only when developing=true. Every other section must use sources <= 36h old. If a story ran in a recent issue (list provided), only reuse it if there is a genuinely NEW development, and frame it explicitly as an update.

SHORT-FORM — If told this is a short-form issue, set isShortForm=true and produce ONLY: subject, opening line, ticker, Big Story, Quick Hits, and sign-off. Set retailTech, cpgCorner, dealFlow, and statOfDay to null.

Never fabricate sources, quotes, or numbers. A boring true issue beats an exciting invented one.`;

function renderMarket(market: MarketSnapshot): string {
  const lines = market.quotes.map((q) => {
    const chg = q.changePct === null ? "n/a" : `${q.changePct > 0 ? "+" : ""}${q.changePct}%`;
    const close = q.lastClose === null ? "n/a" : `$${q.lastClose}`;
    return `  ${q.symbol} (${q.name}): last ${close}, change ${chg}`;
  });
  return `Market snapshot (as of ${market.capturedAt}):\n${lines.join("\n")}\nTop movers, in order: ${
    market.topMoverSymbols.join(", ") || "none available"
  }`;
}

function renderCandidates(candidates: StoryCandidate[]): string {
  return candidates
    .map(
      (c, i) =>
        `[${i + 1}] ${c.title}\n    source: ${c.sourceName} | age: ${c.ageHours}h | url: ${c.url}\n    ${c.snippet}`,
    )
    .join("\n\n");
}

/** Build the initial drafting prompt. */
export function buildDraftPrompt(input: {
  ingest: IngestResult;
  issueDate: string;
  issueNumber: number;
  recentTitles: string[];
}): string {
  const { ingest, issueDate, issueNumber, recentTitles } = input;
  const recent =
    recentTitles.length > 0
      ? `Stories that ran in recent issues (only reuse as an explicit UPDATE with new developments):\n- ${recentTitles.join("\n- ")}`
      : "No recent issues on record.";

  return `Issue #${issueNumber} — ${issueDate}
Mode: ${ingest.shortForm ? "SHORT-FORM (thin news day — Ticker + Big Story + Quick Hits only)" : "FULL"}

${renderMarket(ingest.market)}

${recent}

CANDIDATE STORIES (use only these; cite their URLs):

${renderCandidates(ingest.candidates)}

Write the issue now, obeying every rule in your instructions. Return the structured object.`;
}

/** Build the revision prompt: the full violation list from all failing critics. */
export function buildRevisePrompt(input: {
  previousPrompt: string;
  previousDraftJson: string;
  violations: { critic: string; items: Violation[] }[];
}): string {
  const flaws = input.violations
    .map(
      (v) =>
        `## ${v.critic}\n` +
        v.items
          .map((it) => `- [${it.location}] ${it.issue}\n  fix: ${it.fix_suggestion}`)
          .join("\n"),
    )
    .join("\n\n");

  return `Your previous draft FAILED the Gauntlet. Below is the ORIGINAL brief, your previous draft, and the COMPLETE list of violations from every failing critic. Fix ALL of them in one pass — do not address them one critic at a time, and do not introduce new problems.

──────────── ORIGINAL BRIEF ────────────
${input.previousPrompt}

──────────── YOUR PREVIOUS DRAFT (JSON) ────────────
${input.previousDraftJson}

──────────── VIOLATIONS TO FIX ────────────
${flaws}

Return a corrected structured object that resolves every violation above while keeping everything that already worked.`;
}
