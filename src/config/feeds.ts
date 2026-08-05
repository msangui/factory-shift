/**
 * RSS/Atom feed seed list for ingestion.
 *
 * Editorial bias: Retail & CPG, weighted toward technology and financial news.
 * Feeds are fetched in parallel; a feed that 404s or times out is skipped and
 * logged, never fatal (see src/ingest/rss.ts).
 *
 * `weight` nudges the drafter's story ranking — higher means the source skews
 * toward the tech/financial coverage we want to lead with. It is a soft signal,
 * not a filter.
 */
export interface FeedSource {
  name: string;
  url: string;
  /** 1 (general) … 3 (strong tech/financial retail-CPG signal). */
  weight: 1 | 2 | 3;
}

export const FEEDS: FeedSource[] = [
  { name: "Retail Dive", url: "https://www.retaildive.com/feeds/news/", weight: 3 },
  { name: "Grocery Dive", url: "https://www.grocerydive.com/feeds/news/", weight: 3 },
  { name: "Food Dive", url: "https://www.fooddive.com/feeds/news/", weight: 2 },
  { name: "Modern Retail", url: "https://www.modernretail.co/feed/", weight: 3 },
  { name: "CNBC Retail", url: "https://www.cnbc.com/id/10000116/device/rss/rss.html", weight: 2 },
  { name: "Reuters Business", url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best", weight: 2 },
  { name: "Business of Fashion", url: "https://www.businessoffashion.com/arc/outboundfeeds/rss/?outputType=xml", weight: 1 },
  // Press-release wires for the majors (broad; filtered by relevance downstream).
  { name: "PR Newswire — Retail", url: "https://www.prnewswire.com/rss/consumer-products-retail-latest-news/consumer-products-retail-latest-news-list.rss", weight: 1 },
];
