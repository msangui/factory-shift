import { z } from "zod";
import type { IssueDraft } from "@/draft/schema";
import type { IngestResult } from "@/ingest/types";

export const CRITIC_NAMES = ["fact", "freshness", "voice", "structure", "financial", "html"] as const;
export type CriticName = (typeof CRITIC_NAMES)[number];

export const violationSchema = z.object({
  location: z.string().describe("Where the problem is, e.g. 'bigStory.body' or 'subject candidate 2'."),
  issue: z.string().describe("What is wrong."),
  fix_suggestion: z.string().describe("A concrete fix the drafter can apply."),
});
export type Violation = z.infer<typeof violationSchema>;

/** The uniform verdict every critic returns (spec: {pass, score, violations}). */
export const verdictSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(10),
  violations: z.array(violationSchema),
});
export type Verdict = z.infer<typeof verdictSchema>;

/** Fact critic returns an extra claims table (claim → source URL → supported). */
export const factVerdictSchema = verdictSchema.extend({
  claims: z
    .array(
      z.object({
        claim: z.string(),
        sourceUrl: z.string(),
        supported: z.boolean(),
      }),
    )
    .describe("Every named company, number, %, $, date, and quote mapped to a source URL."),
});
export type FactVerdict = z.infer<typeof factVerdictSchema>;

/** Everything a critic may need. Not every critic uses every field. */
export interface GauntletContext {
  draft: IssueDraft;
  ingest: IngestResult;
  /** The rendered, self-contained HTML for the current draft. */
  html: string;
  issueDate: string;
  issueNumber: number;
  siteUrl: string;
  /** When true, network side-effects (HEAD-checking links, DB lookups) run. */
  live: boolean;
}

export interface Critic {
  name: CriticName;
  run(ctx: GauntletContext): Promise<Verdict>;
}

/** Convenience constructors. */
export const pass = (score = 10): Verdict => ({ pass: true, score, violations: [] });
export const fail = (violations: Violation[], score = 0): Verdict => ({
  pass: violations.length === 0,
  score,
  violations,
});
