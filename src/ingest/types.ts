/** A source captured during ingestion. Every fact must trace back to one. */
export interface CachedSource {
  url: string;
  sourceName: string;
  title: string;
  snippet: string;
  publishedAt: Date;
  fetchedAt: Date;
  feedWeight: number;
}

/** A fresh, in-window candidate story handed to the drafter. */
export interface StoryCandidate {
  url: string;
  sourceName: string;
  title: string;
  snippet: string;
  publishedAt: string; // ISO
  ageHours: number;
  feedWeight: number;
}

/** One watchlist quote for The Ticker. */
export interface Quote {
  symbol: string;
  name: string;
  previousClose: number | null;
  lastClose: number | null;
  changePct: number | null;
  asOf: string | null; // ISO date of the last close
}

/** The market snapshot: the full watchlist plus the computed top movers. */
export interface MarketSnapshot {
  quotes: Quote[];
  /** Symbols of the top 3 movers by absolute % change, biggest first. */
  topMoverSymbols: string[];
  capturedAt: string; // ISO
}

/** Everything ingestion produces for a given run. */
export interface IngestResult {
  candidates: StoryCandidate[];
  market: MarketSnapshot;
  /** True when fewer than the minimum usable fresh stories were found. */
  shortForm: boolean;
}
