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
 *
 * `verified` marks whether the feed URL has actually been observed returning
 * parseable RSS/Atom XML in a real run. Unverified entries were added from
 * platform conventions (Substack always serves `/feed`; WordPress trade sites
 * conventionally serve `/feed/`) without being fetched first — this repo's
 * sandbox has no outbound web access, so they could not be checked before
 * being added. `rss.feed.ok` / `rss.feed.empty` log lines (per feed, per run)
 * are how you confirm or prune them — see ASSUMPTIONS.md's 2026-08-06 entry.
 */
export interface FeedSource {
  name: string;
  url: string;
  /** 1 (general) … 3 (strong tech/financial retail-CPG signal). */
  weight: 1 | 2 | 3;
  /** False = URL guessed from platform convention, never fetched-and-confirmed. */
  verified?: boolean;
}

export const FEEDS: FeedSource[] = [
  // ── Verified (observed producing items in a live run) ─────────────────────
  { name: "Retail Dive", url: "https://www.retaildive.com/feeds/news/", weight: 3, verified: true },
  { name: "Grocery Dive", url: "https://www.grocerydive.com/feeds/news/", weight: 3, verified: true },
  { name: "Food Dive", url: "https://www.fooddive.com/feeds/news/", weight: 2, verified: true },
  { name: "Modern Retail", url: "https://www.modernretail.co/feed/", weight: 3, verified: true },
  { name: "CNBC Retail", url: "https://www.cnbc.com/id/10000116/device/rss/rss.html", weight: 2, verified: true },
  // Business of Fashion 403'd for us in production (bot-blocked) — the URL is a
  // structurally correct Arc XP feed endpoint, but no items have actually come
  // through. Kept in case the block lifts.
  { name: "Business of Fashion", url: "https://www.businessoffashion.com/arc/outboundfeeds/rss/?outputType=xml", weight: 1 },
  // Reuters Business 404'd for us in production; URL likely stale. Kept pending
  // a working replacement.
  { name: "Reuters Business", url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best", weight: 2 },
  // Press-release wires for the majors (broad; filtered by relevance downstream).
  { name: "PR Newswire — Retail", url: "https://www.prnewswire.com/rss/consumer-products-retail-latest-news/consumer-products-retail-latest-news-list.rss", weight: 1, verified: true },

  // ── Added 2026-08-06, unverified (platform-convention URLs; see file header) ─
  // Retail
  { name: "Chain Store Age", url: "https://chainstoreage.com/feed", weight: 2 },
  { name: "WWD", url: "https://wwd.com/feed/", weight: 1 },
  { name: "NRF News", url: "https://nrf.com/blog/feed", weight: 1 },

  // CPG
  { name: "Consumer Goods Technology", url: "https://consumergoods.com/feed", weight: 3 },
  { name: "Consumer Brands Association", url: "https://consumerbrandsassociation.org/news-blog/feed", weight: 1 },

  // Store tech / retail systems
  { name: "RIS News", url: "https://risnews.com/feed", weight: 3 },
  { name: "Retail TouchPoints", url: "https://www.retailtouchpoints.com/feed", weight: 3 },
  { name: "Retail Technology Magazine", url: "https://retailtechnology.co.uk/feed/", weight: 2 },

  // AI / digital / agentic
  { name: "The Information", url: "https://www.theinformation.com/feed", weight: 2 },
  { name: "Stratechery", url: "https://stratechery.com/feed/", weight: 2 },
  { name: "Import AI", url: "https://importai.substack.com/feed", weight: 1 },
  { name: "Latent Space", url: "https://www.latent.space/feed", weight: 1 },
  { name: "Salesforce Retail Blog", url: "https://www.salesforce.com/blog/category/retail/feed/", weight: 2 },
  { name: "Microsoft Industry Blog — Retail", url: "https://www.microsoft.com/en-us/industry/blog/retail/feed/", weight: 2 },
  { name: "AWS Retail Blog", url: "https://aws.amazon.com/blogs/industries/category/retail/feed/", weight: 2 },

  // Ecommerce
  { name: "Digital Commerce 360", url: "https://www.digitalcommerce360.com/feed/", weight: 3 },
  { name: "2PM", url: "https://2pml.com/feed", weight: 2 },
  { name: "Shopifreaks", url: "https://www.shopifreaks.com/feed/", weight: 1 },

  // Not added — see ASSUMPTIONS.md 2026-08-06 for why (no plausible public
  // RSS/Atom mechanism, or an app rather than a content feed):
  //   Retail Brew, Vogue Business, McKinsey Consumer & Retail, Gartner Retail,
  //   Forrester, IDC Retail Insights, Coresight Research, Quartr,
  //   Google Cloud Retail Blog (topic-feed URL pattern not confidently known)
];
