/**
 * Ticker watchlist for The Ticker markets bar.
 * Symbols are the primary US listings; `name` is used in the rendered bar.
 */
export interface WatchItem {
  symbol: string;
  name: string;
}

export const WATCHLIST: WatchItem[] = [
  { symbol: "WMT", name: "Walmart" },
  { symbol: "TGT", name: "Target" },
  { symbol: "COST", name: "Costco" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "PG", name: "Procter & Gamble" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "PEP", name: "PepsiCo" },
  { symbol: "UL", name: "Unilever" },
  { symbol: "EL", name: "Estée Lauder" },
  { symbol: "KMB", name: "Kimberly-Clark" },
  { symbol: "GIS", name: "General Mills" },
  { symbol: "MDLZ", name: "Mondelez" },
  { symbol: "CL", name: "Colgate-Palmolive" },
];

export const WATCHLIST_SYMBOLS = WATCHLIST.map((w) => w.symbol);
