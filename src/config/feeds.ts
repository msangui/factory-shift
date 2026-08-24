/**
 * RSS/Atom feed seed list for ingestion.
 *
 * Editorial bias: Automotive & Manufacturing, weighted toward technology and
 * financial news. Feeds are fetched in parallel; a feed that 404s or times out
 * is skipped and logged, never fatal (see src/ingest/rss.ts).
 *
 * `weight` nudges the drafter's story ranking — higher means the source skews
 * toward the tech/financial coverage we want to lead with. It is a soft signal,
 * not a filter.
 *
 * `verified` marks whether the feed URL has actually been observed returning
 * parseable RSS/Atom XML in a real run. Every entry below is currently
 * UNVERIFIED: the URLs were derived from each publisher's platform convention
 * (WordPress `/feed/`, Industry Dive `/feeds/news/`, Arc XP outbound feeds,
 * etc.) but this repo's sandbox has no outbound web access, so none could be
 * fetched-and-confirmed before being added. `rss.feed.ok` / `rss.feed.empty`
 * log lines (per feed, per run) are how you confirm or prune them — see the
 * ASSUMPTIONS.md note on feed verification. Expect to correct a handful of
 * these URLs after the first live run.
 */
export interface FeedSource {
  name: string;
  url: string;
  /** 1 (general) … 3 (strong tech/financial automotive-manufacturing signal). */
  weight: 1 | 2 | 3;
  /** False = URL guessed from platform convention, never fetched-and-confirmed. */
  verified?: boolean;
}

export const FEEDS: FeedSource[] = [
  // ── Automotive ────────────────────────────────────────────────────────────
  { name: "Automotive News", url: "https://www.autonews.com/arc/outboundfeeds/rss/?outputType=xml", weight: 3 },
  { name: "Automotive World", url: "https://www.automotiveworld.com/feed/", weight: 2 },
  { name: "Automotive Industries (AI Online)", url: "https://ai-online.com/feed/", weight: 1 },
  { name: "Automotive Powertrain Technology Intl", url: "https://www.automotivepowertraintechnologyinternational.com/feed/", weight: 1 },
  { name: "Center for Automotive Research", url: "https://www.cargroup.org/feed/", weight: 1 },
  { name: "InsideEVs", url: "https://insideevs.com/rss/articles/all/", weight: 2 },

  // ── Manufacturing ─────────────────────────────────────────────────────────
  { name: "Manufacturing Dive", url: "https://www.manufacturingdive.com/feeds/news/", weight: 3 },
  { name: "Smart Industry", url: "https://www.smartindustry.com/feed/", weight: 3 },
  { name: "IndustryWeek", url: "https://www.industryweek.com/rss.xml", weight: 3 },
  { name: "Automation.com", url: "https://www.automation.com/feed", weight: 2 },
  { name: "ManufacturingTomorrow", url: "https://www.manufacturingtomorrow.com/rss/news/", weight: 2 },
  { name: "Assembly Magazine", url: "https://www.assemblymag.com/rss/articles", weight: 2 },
  { name: "Quality Digest", url: "https://www.qualitydigest.com/rss.xml", weight: 1 },
  { name: "Manufacturing Digital", url: "https://manufacturingdigital.com/feed", weight: 2 },

  // ── Tech / AI in automotive & manufacturing ───────────────────────────────
  { name: "SAE International", url: "https://www.sae.org/rss", weight: 2 },
  { name: "Automotive Dive", url: "https://www.automotivedive.com/feeds/news/", weight: 3 },
  { name: "Manufacturing.net", url: "https://www.manufacturing.net/rss/all", weight: 2 },
  { name: "Robotics Business Review", url: "https://www.roboticsbusinessreview.com/feed/", weight: 2 },
  { name: "IoT World Today", url: "https://www.iotworldtoday.com/feed/", weight: 1 },

  // ── Analysts / primary sources ────────────────────────────────────────────
  // Low-confidence: analyst sites rarely expose per-industry public RSS. Kept
  // at weight 1 (insight, not daily news) and expected to need pruning.
  { name: "McKinsey Insights", url: "https://www.mckinsey.com/insights/rss", weight: 1 },

  // Not added — no reliable public per-industry RSS/Atom mechanism. The topic
  // pages requested (below) render HTML only; adding them as feeds would just
  // log rss.feed.empty every run. Tracked here for provenance; wire them in via
  // a dedicated scraper (see BACKLOG.md) if their content is essential:
  //   Gartner Manufacturing   https://www.gartner.com/en/industries/manufacturing
  //   Gartner Automotive      https://www.gartner.com/en/industries/automotive
  //   McKinsey Auto & Assembly (article hub; global Insights RSS above is the closest feed)
  //     https://www.mckinsey.com/industries/automotive-and-assembly/our-insights
  //   Deloitte Manufacturing  https://www2.deloitte.com/us/en/pages/manufacturing/topics/manufacturing.html
];
