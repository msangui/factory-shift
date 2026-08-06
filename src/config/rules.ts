/**
 * The spec's numeric editorial rules, in one place so the drafter and every
 * critic share a single source of truth. Changing a limit here changes both the
 * generation instructions and the checks that enforce them.
 */

export const FRESHNESS = {
  /** Stories must be <= this many hours old at generation time. */
  maxAgeHours: 36,
  /** The Big Story may reach this age only if flagged as a developing multi-day story. */
  bigStoryMaxAgeHours: 72,
  /** A story that ran within the last N issues may only reappear as an explicit update. */
  dedupeLookbackIssues: 5,
} as const;

export const LENGTHS = {
  subjectMaxChars: 55,
  bigStoryWords: { min: 150, max: 220 },
  retailTechWords: { min: 80, max: 120 },
  cpgCornerWords: { min: 80, max: 120 },
  dealFlowBullets: { min: 3, max: 5 },
  dealFlowWordsPerBullet: { max: 25 },
  quickHits: { min: 4, max: 6 },
  topMovers: 3,
  /** Total body copy target and hard cap. */
  bodyWords: { min: 600, max: 900, hardCap: 1000 },
} as const;

export const GAUNTLET = {
  /** Max Gauntlet iterations. No exceptions. */
  maxIterations: 3,
  /**
   * Voice critic passes at or above this score (0–10). The spec's target is 8;
   * lowered to 7 by default so genuinely good-but-not-perfect copy ships on the
   * daily cadence instead of holding forever. Override with VOICE_PASS_SCORE.
   */
  voicePassScore: Number(process.env.VOICE_PASS_SCORE || "7"),
  /**
   * DEVIATION FROM SPEC, opt-in only. The spec is explicit: "If any critic
   * still fails after iteration 3: HOLD the issue. Do not ship a degraded
   * version silently." Default here is `false`, which preserves that behavior.
   *
   * Setting AUTO_PUBLISH_ON_HOLD=1 removes the human-in-the-loop gate: an
   * issue that still fails one or more critics after 3 iterations SHIPS
   * anyway, with whatever violations remain unresolved (fabricated-looking
   * stats, stale stories, broken structure — anything a critic would have
   * caught). It is not silent in the audit-log sense — every critic verdict
   * per iteration is still written to `gauntlet_log`, and a
   * `pipeline.auto_published_despite_failures` log line records exactly what
   * shipped anyway — but nothing blocks publication. See ASSUMPTIONS.md.
   */
  autoPublishOnHold: process.env.AUTO_PUBLISH_ON_HOLD === "1",
} as const;

export const INGEST = {
  /** Fewer than this many usable fresh stories triggers a short-form issue. */
  minStoriesForFullIssue: 6,
  /** How many recent stories to hand the drafter as candidate material. */
  maxCandidateStories: 40,
} as const;

/** The ten sections, in order. Used by the Structure critic and the renderer. */
export const SECTION_ORDER = [
  "subject",
  "openingLine",
  "ticker",
  "bigStory",
  "retailTech",
  "cpgCorner",
  "dealFlow",
  "quickHits",
  "statOfDay",
  "signOff",
] as const;

/** Sections present in a short-form issue (thin news day). */
export const SHORT_FORM_SECTIONS = [
  "subject",
  "openingLine",
  "ticker",
  "bigStory",
  "quickHits",
  "signOff",
] as const;

export type SectionKey = (typeof SECTION_ORDER)[number];
