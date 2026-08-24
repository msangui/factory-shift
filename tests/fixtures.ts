import type { IssueDraft } from "@/draft/schema";
import type { GauntletContext } from "@/gauntlet/types";
import type { IngestResult, MarketSnapshot, StoryCandidate } from "@/ingest/types";

/** n filler words, all single tokens, so word count == n. */
export function w(n: number): string {
  return Array.from({ length: n }, () => "gear").join(" ");
}

const NOW_ISO = new Date().toISOString();

export function makeCandidates(): StoryCandidate[] {
  return Array.from({ length: 8 }, (_, i) => ({
    url: `https://example.com/story-${i + 1}`,
    sourceName: "Manufacturing Dive",
    title: `Fresh factory story number ${i + 1}`,
    snippet: "A fresh, in-window story used as source material.",
    publishedAt: NOW_ISO,
    ageHours: 5,
    feedWeight: 3,
  }));
}

export function makeMarket(): MarketSnapshot {
  return {
    quotes: [
      { symbol: "TSLA", name: "Tesla", previousClose: 100, lastClose: 103.2, changePct: 3.2, asOf: "2026-08-05" },
      { symbol: "F", name: "Ford", previousClose: 100, lastClose: 98.9, changePct: -1.1, asOf: "2026-08-05" },
      { symbol: "GM", name: "General Motors", previousClose: 100, lastClose: 100.9, changePct: 0.9, asOf: "2026-08-05" },
      { symbol: "APTV", name: "Aptiv", previousClose: 100, lastClose: 100.2, changePct: 0.2, asOf: "2026-08-05" },
    ],
    topMoverSymbols: ["TSLA", "F", "GM"],
    capturedAt: NOW_ISO,
  };
}

export function makeIngest(overrides: Partial<IngestResult> = {}): IngestResult {
  return {
    candidates: makeCandidates(),
    market: makeMarket(),
    shortForm: false,
    ...overrides,
  };
}

/** A clean, spec-compliant full-issue draft that should pass every deterministic critic. */
export function makeValidDraft(): IssueDraft {
  const u = (i: number) => `https://example.com/story-${i}`;
  return {
    isShortForm: false,
    subjectCandidates: ["GM climbs; Tesla margins in focus", "Autos' numbers day, in brief"],
    chosenSubjectIndex: 0,
    previewText: "Earnings, deals, and one very busy assembly line.",
    openingLine: w(15),
    ticker: {
      moverNotes: [
        { symbol: "TSLA", why: w(5) },
        { symbol: "F", why: w(5) },
        { symbol: "GM", why: w(5) },
      ],
    },
    bigStory: {
      title: "Tesla's automation bet pays off",
      body: w(200),
      whyItMatters: w(15),
      developing: false,
      sourceUrls: [u(1)],
    },
    shopFloor: { title: "Factory robotics grows up", body: w(110), sourceUrls: [u(2)] },
    oemCorner: { title: "An OEM portfolio shuffle", body: w(110), sourceUrls: [u(3)] },
    dealFlow: [
      { text: `$4.2B ${w(11)}`, sourceUrl: u(4) },
      { text: `$1.1B ${w(11)}`, sourceUrl: u(5) },
      { text: `$3.0B ${w(11)}`, sourceUrl: u(6) },
      { text: `$0.5B ${w(11)}`, sourceUrl: u(7) },
      { text: `12% ${w(11)}`, sourceUrl: u(8) },
    ],
    quickHits: [
      { text: w(8), sourceUrl: u(1) },
      { text: w(8), sourceUrl: u(2) },
      { text: w(8), sourceUrl: u(3) },
      { text: w(8), sourceUrl: u(4) },
      { text: w(8), sourceUrl: u(5) },
      { text: w(8), sourceUrl: u(6) },
    ],
    statOfDay: { stat: "$4.2B", context: w(20), sourceUrl: u(1) },
    signOff: w(10),
  };
}

/** Build a GauntletContext for deterministic (offline) critic runs. */
export function makeCtx(draft: IssueDraft, opts: { html?: string; ingest?: IngestResult } = {}): GauntletContext {
  return {
    draft,
    ingest: opts.ingest ?? makeIngest(),
    html: opts.html ?? "",
    issueDate: "2026-08-05",
    issueNumber: 1,
    siteUrl: "https://example.com",
    live: false,
  };
}
