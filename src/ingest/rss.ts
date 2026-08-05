import { XMLParser } from "fast-xml-parser";
import { FEEDS, type FeedSource } from "@/config/feeds";
import type { CachedSource } from "@/ingest/types";
import { log } from "@/lib/logger";
import { stripHtml, truncate } from "@/lib/util";

const FETCH_TIMEOUT_MS = 12_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

/** Coerce a possibly-array XML node into an array. */
function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** Pull the best link out of an RSS item or Atom entry. */
function extractLink(item: Record<string, unknown>): string | null {
  const link = item.link;
  if (typeof link === "string") return link;
  // Atom: link can be an object or array of { @_href, @_rel }.
  const links = asArray(link as unknown);
  for (const l of links) {
    if (l && typeof l === "object") {
      const rec = l as Record<string, unknown>;
      const rel = rec["@_rel"];
      const href = rec["@_href"];
      if (typeof href === "string" && (rel === undefined || rel === "alternate")) return href;
    }
  }
  const firstHref = (links[0] as Record<string, unknown> | undefined)?.["@_href"];
  return typeof firstHref === "string" ? firstHref : null;
}

function extractText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const rec = v as Record<string, unknown>;
    if (typeof rec["#text"] === "string") return rec["#text"] as string;
  }
  return "";
}

function parseDate(v: unknown): Date | null {
  const s = extractText(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fetch one feed with a hard timeout; returns [] on any error (never throws). */
async function fetchFeed(feed: FeedSource): Promise<CachedSource[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "user-agent": "MorningShelfBot/0.1 (+newsletter ingestion)" },
    });
    if (!res.ok) {
      log.warn("rss.fetch.non_ok", { feed: feed.name, status: res.status });
      return [];
    }
    const xml = await res.text();
    return parseFeedXml(xml, feed);
  } catch (err) {
    log.warn("rss.fetch.error", { feed: feed.name, error: String(err) });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Parse RSS 2.0 or Atom XML into CachedSource[]. Exported for tests. */
export function parseFeedXml(xml: string, feed: FeedSource): CachedSource[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch (err) {
    log.warn("rss.parse.error", { feed: feed.name, error: String(err) });
    return [];
  }

  const now = new Date();
  const out: CachedSource[] = [];

  const rss = doc.rss as Record<string, unknown> | undefined;
  const atom = doc.feed as Record<string, unknown> | undefined;

  const items: Record<string, unknown>[] = rss
    ? asArray((rss.channel as Record<string, unknown> | undefined)?.item as unknown).map((x) => x as Record<string, unknown>)
    : atom
      ? asArray(atom.entry as unknown).map((x) => x as Record<string, unknown>)
      : [];

  for (const item of items) {
    const title = extractText(item.title).trim();
    const url = extractLink(item);
    if (!title || !url) continue;

    const rawSummary =
      extractText(item.description) ||
      extractText(item.summary) ||
      extractText((item as Record<string, unknown>)["content:encoded"]) ||
      extractText(item.content);
    const snippet = truncate(stripHtml(rawSummary), 500);

    const published =
      parseDate(item.pubDate) ??
      parseDate(item.published) ??
      parseDate(item.updated) ??
      parseDate((item as Record<string, unknown>)["dc:date"]) ??
      now; // Fall back to now; the freshness filter will still apply.

    out.push({
      url,
      sourceName: feed.name,
      title,
      snippet,
      publishedAt: published,
      fetchedAt: now,
      feedWeight: feed.weight,
    });
  }

  return out;
}

/** Fetch every configured feed in parallel and flatten the results. */
export async function fetchAllFeeds(): Promise<CachedSource[]> {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const all = results.flat();
  log.info("rss.fetched", { feeds: FEEDS.length, items: all.length });
  return all;
}
