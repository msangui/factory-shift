import { WATCHLIST } from "@/config/watchlist";
import type { MarketSnapshot, Quote } from "@/ingest/types";
import { log } from "@/lib/logger";

const FETCH_TIMEOUT_MS = 10_000;

// Yahoo Finance's chart endpoint responds from datacenter/CI IPs (Stooq blocks
// them), needs no key, and returns daily closes we can diff for the % change.
function base(): string {
  return process.env.QUOTES_BASE_URL ?? "https://query1.finance.yahoo.com";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function fetchQuote(symbol: string, name: string): Promise<Quote> {
  const empty: Quote = { symbol, name, previousClose: null, lastClose: null, changePct: null, asOf: null };
  const url = `${base()}/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // A browser-like UA avoids Yahoo's bot rejection.
        "user-agent": "Mozilla/5.0 (compatible; MorningShelfBot/0.1)",
        accept: "application/json",
      },
    });
    if (!res.ok) {
      log.warn("quotes.non_ok", { symbol, status: res.status });
      return empty;
    }
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: Record<string, unknown>; timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }>; error?: unknown };
    };
    const result = json.chart?.result?.[0];
    if (!result) return empty;

    const meta = result.meta ?? {};
    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => num(c) !== null);

    const lastClose = closes.at(-1) ?? num(meta.regularMarketPrice);
    const previousClose =
      closes.length >= 2 ? closes[closes.length - 2]! : num(meta.chartPreviousClose) ?? num(meta.previousClose);

    if (lastClose === null || previousClose === null || previousClose === 0) return empty;

    const changePct = ((lastClose - previousClose) / previousClose) * 100;
    const epoch = num(meta.regularMarketTime) ?? result.timestamp?.at(-1) ?? null;
    const asOf = epoch !== null ? new Date(epoch * 1000).toISOString().slice(0, 10) : null;

    return {
      symbol,
      name,
      previousClose: Math.round(previousClose * 100) / 100,
      lastClose: Math.round(lastClose * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      asOf,
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
