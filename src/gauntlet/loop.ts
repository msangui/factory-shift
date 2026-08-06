import { GAUNTLET } from "@/config/rules";
import { draftIssue, reviseIssue } from "@/draft/drafter";
import type { IssueDraft } from "@/draft/schema";
import { runGauntlet } from "@/gauntlet/index";
import type { CriticName, Verdict } from "@/gauntlet/types";
import type { IngestResult } from "@/ingest/types";
import { logVerdict } from "@/lib/db";
import type { TokenLedger } from "@/lib/llm";
import { log } from "@/lib/logger";
import { renderIssueHtml } from "@/render/html";

export interface LoopResult {
  status: "ship" | "hold";
  finalDraft: IssueDraft;
  finalHtml: string;
  iterations: number;
  /** Every draft produced, oldest first (for the hold report). */
  drafts: IssueDraft[];
  /** Verdicts from the final iteration. */
  lastVerdicts: Record<CriticName, Verdict>;
  /** Critics still failing at the end (empty on ship). */
  failingCritics: CriticName[];
  unresolvedViolations: { critic: CriticName; items: Verdict["violations"] }[];
  /** True when this shipped only because AUTO_PUBLISH_ON_HOLD bypassed a failing Gauntlet. */
  autoPublished: boolean;
}

/**
 * The Gauntlet loop: DRAFT → GAUNTLET → (REVISE → GAUNTLET)* → SHIP or HOLD.
 * At most `GAUNTLET.maxIterations` gauntlet runs. A draft passes only if EVERY
 * critic passes. Each critic verdict is logged per iteration when `persist`.
 */
export async function runGauntletLoop(input: {
  ingest: IngestResult;
  issueDate: string;
  issueNumber: number;
  siteUrl: string;
  recentTitles: string[];
  ledger: TokenLedger;
  /** true in production (DB writes, live link/dedup checks); false in tests. */
  persist: boolean;
}): Promise<LoopResult> {
  const { ingest, issueDate, issueNumber, siteUrl, recentTitles, ledger, persist } = input;

  const { draft: firstDraft, prompt } = await draftIssue({
    ingest,
    issueDate,
    issueNumber,
    recentTitles,
    ledger,
  });

  const drafts: IssueDraft[] = [firstDraft];
  let current = firstDraft;
  let currentPrompt = prompt;

  for (let iteration = 1; iteration <= GAUNTLET.maxIterations; iteration++) {
    const html = renderIssueHtml({ draft: current, market: ingest.market, issueNumber, issueDate, siteUrl });
    const run = await runGauntlet({
      draft: current,
      ingest,
      html,
      issueDate,
      issueNumber,
      siteUrl,
      live: persist,
    });

    if (persist) {
      await Promise.all(
        (Object.entries(run.verdicts) as [CriticName, Verdict][]).map(([critic, verdict]) =>
          logVerdict(issueDate, iteration, critic, verdict),
        ),
      );
    }

    log.info("gauntlet.iteration", {
      issueDate,
      iteration,
      passed: run.passed,
      failing: run.failing.map((f) => f.critic),
    });

    if (run.passed) {
      return {
        status: "ship",
        finalDraft: current,
        finalHtml: html,
        iterations: iteration,
        drafts,
        lastVerdicts: run.verdicts,
        failingCritics: [],
        unresolvedViolations: [],
        autoPublished: false,
      };
    }

    // Out of iterations. Spec default: HOLD. Opt-in (AUTO_PUBLISH_ON_HOLD=1):
    // ship anyway with the remaining violations left unresolved.
    if (iteration === GAUNTLET.maxIterations) {
      return {
        status: GAUNTLET.autoPublishOnHold ? "ship" : "hold",
        finalDraft: current,
        finalHtml: html,
        iterations: iteration,
        drafts,
        lastVerdicts: run.verdicts,
        failingCritics: run.failing.map((f) => f.critic),
        unresolvedViolations: run.failing,
        autoPublished: GAUNTLET.autoPublishOnHold,
      };
    }

    // Revise against the FULL violation list from all failing critics, in one pass.
    current = await reviseIssue({
      previousPrompt: currentPrompt,
      previousDraft: current,
      violations: run.failing.map((f) => ({ critic: f.critic, items: f.items })),
      shortForm: ingest.shortForm,
      ledger,
    });
    currentPrompt = prompt; // The original brief remains the anchor across revisions.
    drafts.push(current);
  }

  // Unreachable, but satisfies the type checker.
  throw new Error("Gauntlet loop exited without a decision.");
}
