import { WATCHLIST } from "@/config/watchlist";
import type { MarketSnapshot, Quote } from "@/ingest/types";
import { log } from "@/lib/logger";

const FETCH_TIMEOUT_MS = 10_000;

function base(): string {
  return process.env.QUOTES_BASE_URL ?? "https://stooq.com";
}

/** YYYYMMDD in UTC. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Stooq daily history CSV for one symbol over a bounded window. Free, keyless,
 * end-of-day. Returns the last two closes so we can compute the % change.
 * Columns: Date,Open,High,Low,Close,Volume.
 */
async function fetchQuote(symbol: string, name: string): Promise<Quote> {
  const empty: Quote = { symbol, name, previousClose: null, lastClose: null, changePct: null, asOf: null };
  const now = new Date();
  const from = new Date(now.getTime() - 16 * 24 * 3_600_000);
  const url = `${base()}/q/d/l/?s=${symbol.toLowerCase()}.us&d1=${ymd(from)}&d2=${ymd(now)}&i=d`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      log.warn("quotes.non_ok", { symbol, status: res.status });
      return empty;
    }
    const csv = (await res.text()).trim();
    const lines = csv.split(/\r?\n/).filter(Boolean);
    // Need header + at least two data rows.
    if (lines.length < 3) return empty;
    const rows = lines.slice(1).map((l) => l.split(","));
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (!last || !prev) return empty;
    const lastClose = Number.parseFloat(last[4] ?? "");
    const previousClose = Number.parseFloat(prev[4] ?? "");
    if (!Number.isFinite(lastClose) || !Number.isFinite(previousClose) || previousClose === 0) {
      return empty;
    }
    const changePct = ((lastClose - previousClose) / previousClose) * 100;
    return {
      symbol,
      name,
      previousClose,
      lastClose,
      changePct: Math.round(changePct * 100) / 100,
      asOf: last[0] ?? null,
    };
  } catch (err) {
    log.warn("quotes.error", { symbol, error: String(err) });
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch the whole watchlist and compute the top-3 movers by |% change|. */
export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const quotes = await Promise.all(WATCHLIST.map((w) => fetchQuote(w.symbol, w.name)));

  const topMoverSymbols = [...quotes]
    .filter((q) => q.changePct !== null)
    .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
    .slice(0, 3)
    .map((q) => q.symbol);

  log.info("quotes.snapshot", {
    ok: quotes.filter((q) => q.changePct !== null).length,
    total: quotes.length,
    topMovers: topMoverSymbols,
  });

  return { quotes, topMoverSymbols, capturedAt: new Date().toISOString() };
}
