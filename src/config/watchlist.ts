/**
 * Ticker watchlist for The Ticker markets bar.
 * Symbols are the primary US listings; `name` is used in the rendered bar.
 *
 * Mix: automakers/EV, tier-1 auto suppliers, and industrial/automation names.
 * All are US-listed primaries (not thin ADRs) so the Stooq quote source in
 * src/ingest/quotes.ts resolves them reliably.
 */
export interface WatchItem {
  symbol: string;
  name: string;
}

export const WATCHLIST: WatchItem[] = [
  // Automakers & EV
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "F", name: "Ford" },
  { symbol: "GM", name: "General Motors" },
  { symbol: "STLA", name: "Stellantis" },
  { symbol: "TM", name: "Toyota" },
  { symbol: "RIVN", name: "Rivian" },
  // Tier-1 suppliers
  { symbol: "APTV", name: "Aptiv" },
  { symbol: "BWA", name: "BorgWarner" },
  { symbol: "MGA", name: "Magna" },
  // Industrial / automation / heavy equipment
  { symbol: "CAT", name: "Caterpillar" },
  { symbol: "DE", name: "Deere" },
  { symbol: "ETN", name: "Eaton" },
  { symbol: "ROK", name: "Rockwell Automation" },
  { symbol: "HON", name: "Honeywell" },
];

export const WATCHLIST_SYMBOLS = WATCHLIST.map((w) => w.symbol);
