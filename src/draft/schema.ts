import { z } from "zod";

/**
 * The structured shape of one issue draft. The drafter emits exactly this; the
 * renderer and every critic read it. Numbers for The Ticker are NOT here — they
 * come from the market snapshot at render time so the model can never invent a
 * price. The model only supplies the one-line "why" for the top movers.
 */

const sourced = z.object({
  title: z.string().describe("Punchy headline for the section."),
  body: z.string().describe("Body copy for the section."),
  sourceUrls: z
    .array(z.string().url())
    .min(1)
    .describe("Every URL, from the provided sources, that this section's facts trace to."),
});

export const bigStorySchema = sourced.extend({
  whyItMatters: z.string().describe("One sentence: why it matters."),
  developing: z
    .boolean()
    .describe("True only if this is a genuinely developing multi-day story (allows up to 72h old)."),
});

export const moverNoteSchema = z.object({
  symbol: z.string().describe("Ticker symbol from the watchlist."),
  why: z.string().describe("One short clause on why it moved. No invented numbers."),
});

export const bulletSchema = z.object({
  text: z.string().describe("<= 25 words, MUST contain a hard number."),
  sourceUrl: z.string().url(),
});

export const quickHitSchema = z.object({
  text: z.string().describe("One-liner, mixed automotive/manufacturing."),
  sourceUrl: z.string().url(),
});

export const statSchema = z.object({
  stat: z.string().describe("A single number (e.g. '$4.2B', '3.1%')."),
  context: z.string().describe("One sentence of context."),
  sourceUrl: z.string().url(),
});

/**
 * The nested (object/array-typed) draft fields. Claude's structured-output tool
 * call occasionally serializes one of these as a JSON *string* instead of
 * inlining the object/array (observed in production on `bigStory`: zod rejects
 * it with "Expected object, received string", generateObject's repair then
 * fails with AI_NoObjectGeneratedError, and the whole pipeline run aborts).
 */
const NESTED_DRAFT_KEYS = [
  "subjectCandidates",
  "ticker",
  "bigStory",
  "shopFloor",
  "oemCorner",
  "dealFlow",
  "quickHits",
  "statOfDay",
] as const;

const baseIssueDraftSchema = z.object({
  isShortForm: z.boolean(),
  subjectCandidates: z
    .array(z.string())
    .length(2)
    .describe("Two candidate subject lines, each <= 55 characters."),
  chosenSubjectIndex: z.number().int().min(0).max(1),
  previewText: z.string().describe("Inbox preview text."),
  openingLine: z.string().describe("One witty sentence tied to the day's lead."),
  ticker: z.object({
    moverNotes: z
      .array(moverNoteSchema)
      .max(3)
      .describe("A one-line 'why' for each of the top 3 movers (order matches the snapshot)."),
  }),
  bigStory: bigStorySchema.nullable(),
  shopFloor: sourced.nullable().describe("Factory/vehicle tech: automation, robotics, IIoT, AI, EV/ADAS/software-defined vehicles, supply chain. Null in short-form."),
  oemCorner: sourced.nullable().describe("An automaker or manufacturer: earnings, pricing, capacity, product portfolio, capital allocation. Null in short-form."),
  dealFlow: z.array(bulletSchema).nullable().describe("3–5 bullets. Null in short-form."),
  quickHits: z.array(quickHitSchema).describe("4–6 one-liners."),
  statOfDay: statSchema.nullable().describe("Null in short-form."),
  signOff: z.string().describe("One line of personality."),
});

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** A value that carries the marker fields every full/short-form draft has. */
function isDraftLike(o: unknown): o is Record<string, unknown> {
  return (
    !!o &&
    typeof o === "object" &&
    !Array.isArray(o) &&
    "subjectCandidates" in o &&
    "quickHits" in o &&
    "signOff" in o
  );
}

/**
 * Tolerant wrapper for the two ways Claude's structured-output tool call has
 * mis-shaped a complete draft in production, both of which otherwise crash the
 * run with AI_NoObjectGeneratedError:
 *
 *   1. a nested field returned as a JSON *string* instead of an object/array
 *      (e.g. `bigStory: "{ ... }"`);
 *   2. the *entire* draft nested under a single wrapper key
 *      (e.g. `{ bigStory: { ...the whole issue... } }`).
 *
 * We JSON.parse case 1's strings and unwrap case 2 before validation, then hand
 * the repaired value to the real schema. The tool schema the model sees is
 * unchanged (zod emits the inner object schema for a preprocess effect), so this
 * only adds tolerance for the flaky serialization — it never changes the ask.
 * Anything unrecognized passes through so the inner schema reports the real
 * error. Turns a hard crash into a silent recovery on the first attempt.
 */
export const issueDraftSchema = z.preprocess((val) => {
  let obj = val;
  if (typeof obj === "string") obj = tryParseJson(obj) ?? obj;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return val;
  let draft = obj as Record<string, unknown>;

  // (2) Unwrap a draft that got nested under a single wrapper key.
  if (!isDraftLike(draft)) {
    for (const key of Object.keys(draft)) {
      const raw = draft[key];
      const inner = typeof raw === "string" ? tryParseJson(raw) : raw;
      if (isDraftLike(inner)) {
        draft = inner;
        break;
      }
    }
  }

  // (1) Parse any nested field returned as a stringified object/array.
  let out: Record<string, unknown> | null = null;
  for (const key of NESTED_DRAFT_KEYS) {
    const v = draft[key];
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s[0] !== "{" && s[0] !== "[") continue;
    const parsed = tryParseJson(s);
    if (parsed !== undefined) {
      out ??= { ...draft };
      out[key] = parsed;
    }
  }
  return out ?? draft;
}, baseIssueDraftSchema);

export type IssueDraft = z.infer<typeof issueDraftSchema>;
export type BigStory = z.infer<typeof bigStorySchema>;
export type SourcedSection = z.infer<typeof sourced>;
