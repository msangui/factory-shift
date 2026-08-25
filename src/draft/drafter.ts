import { issueDraftSchema, type IssueDraft } from "@/draft/schema";
import { DRAFTER_SYSTEM, buildDraftPrompt, buildRevisePrompt } from "@/draft/prompt";
import type { IngestResult } from "@/ingest/types";
import type { Violation } from "@/gauntlet/types";
import { drafterModel, generateStructured, type TokenLedger } from "@/lib/llm";

const DRAFT_MAX_TOKENS = 6000;
// The draft is the largest, most deeply nested schema, and Claude's tool call
// occasionally mis-serializes a section. More attempts (with the escalating
// temperature in generateStructured) give resampling room to recover before the
// whole run is held. Critics keep the default 2.
const DRAFT_ATTEMPTS = 5;

/** Generate the first draft of an issue. Returns the draft and the prompt used. */
export async function draftIssue(input: {
  ingest: IngestResult;
  issueDate: string;
  issueNumber: number;
  recentTitles: string[];
  ledger: TokenLedger;
}): Promise<{ draft: IssueDraft; prompt: string }> {
  const prompt = buildDraftPrompt(input);
  const draft = await generateStructured({
    schema: issueDraftSchema,
    system: DRAFTER_SYSTEM,
    prompt,
    model: drafterModel(),
    stage: "draft",
    ledger: input.ledger,
    maxOutputTokens: DRAFT_MAX_TOKENS,
    attempts: DRAFT_ATTEMPTS,
  });
  // Force the short-form flag to match what ingestion decided.
  draft.isShortForm = input.ingest.shortForm;
  return { draft, prompt };
}

/** Revise a failed draft against the complete violation list. */
export async function reviseIssue(input: {
  previousPrompt: string;
  previousDraft: IssueDraft;
  violations: { critic: string; items: Violation[] }[];
  shortForm: boolean;
  ledger: TokenLedger;
}): Promise<IssueDraft> {
  const prompt = buildRevisePrompt({
    previousPrompt: input.previousPrompt,
    previousDraftJson: JSON.stringify(input.previousDraft, null, 2),
    violations: input.violations,
  });
  const draft = await generateStructured({
    schema: issueDraftSchema,
    system: DRAFTER_SYSTEM,
    prompt,
    model: drafterModel(),
    stage: "revise",
    ledger: input.ledger,
    maxOutputTokens: DRAFT_MAX_TOKENS,
    attempts: DRAFT_ATTEMPTS,
  });
  draft.isShortForm = input.shortForm;
  return draft;
}
