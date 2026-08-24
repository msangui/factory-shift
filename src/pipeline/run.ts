import { FRESHNESS } from "@/config/rules";
import { estimateCostUsd } from "@/config/pricing";
import { bodyWordCount } from "@/gauntlet/critics/structure";
import { runGauntletLoop } from "@/gauntlet/loop";
import { ingest } from "@/ingest/index";
import { getIssue, nextIssueNumber, recentIssueTitles, saveHold, saveIssue, type IssueStatus } from "@/lib/db";
import { TokenLedger } from "@/lib/llm";
import { log } from "@/lib/logger";
import { isoDateInTz, normalizeSiteUrl } from "@/lib/util";

export const NEWSLETTER_TZ = "America/New_York";

export interface PipelineSummary {
  issueDate: string;
  issueNumber: number;
  status: IssueStatus | "skipped";
  iterations: number;
  isShortForm: boolean;
  wordCount: number;
  failingCritics: string[];
  cost: { inputTokens: number; outputTokens: number; calls: number; usd: number; perStage: unknown };
}

/**
 * The full daily pipeline: INGEST → DRAFT → GAUNTLET → SHIP or HOLD, then
 * persist. Idempotent per date: if today's issue already exists it is skipped
 * unless `force` is set.
 */
export async function runPipeline(opts: { force?: boolean; now?: Date } = {}): Promise<PipelineSummary> {
  const now = opts.now ?? new Date();
  const issueDate = isoDateInTz(now, NEWSLETTER_TZ);
  const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

  const existing = await getIssue(issueDate);
  if (existing && !opts.force) {
    log.info("pipeline.skip_existing", { issueDate, status: existing.status });
    return {
      issueDate,
      issueNumber: existing.issue_number,
      status: "skipped",
      iterations: existing.iterations,
      isShortForm: existing.is_short_form,
      wordCount: existing.word_count,
      failingCritics: [],
      cost: { inputTokens: 0, outputTokens: 0, calls: 0, usd: 0, perStage: [] },
    };
  }

  const ledger = new TokenLedger();
  const issueNumber = existing?.issue_number ?? (await nextIssueNumber());

  const [ingestResult, recentTitles] = await Promise.all([
    ingest({ persist: true }),
    recentIssueTitles(FRESHNESS.dedupeLookbackIssues),
  ]);

  const result = await runGauntletLoop({
    ingest: ingestResult,
    issueDate,
    issueNumber,
    siteUrl,
    recentTitles,
    ledger,
    persist: true,
  });

  const wordCount = bodyWordCount(result.finalDraft);
  const subject =
    result.finalDraft.subjectCandidates[result.finalDraft.chosenSubjectIndex] ??
    result.finalDraft.subjectCandidates[0] ??
    "The Factory Shift";

  const status: IssueStatus =
    result.status === "hold"
      ? "held"
      : result.finalDraft.isShortForm
        ? "short_form_shipped"
        : "shipped";

  // Persist. A hold must never demote an already-shipped issue: if a force
  // re-run holds while a shipped version is live, keep the live version and
  // stash the new draft on the holds row for review/manual ship.
  const wasLive = existing?.status === "shipped" || existing?.status === "short_form_shipped";
  if (result.status === "hold" && wasLive) {
    await saveHold(
      issueDate,
      result.failingCritics,
      result.unresolvedViolations,
      result.drafts,
      result.finalHtml,
      result.finalDraft,
    );
    log.warn("pipeline.hold_kept_live", {
      issueDate,
      failing: result.failingCritics,
      iterations: result.iterations,
      note: "previously shipped issue kept live; held draft stashed for review",
    });
  } else {
    await saveIssue({
      issueDate,
      issueNumber,
      status,
      subject,
      previewText: result.finalDraft.previewText,
      isShortForm: result.finalDraft.isShortForm,
      iterations: result.iterations,
      wordCount,
      body: result.finalDraft,
      html: result.finalHtml,
    });
    if (result.status === "hold") {
      await saveHold(
        issueDate,
        result.failingCritics,
        result.unresolvedViolations,
        result.drafts,
        result.finalHtml,
        result.finalDraft,
      );
      log.warn("pipeline.hold", { issueDate, failing: result.failingCritics, iterations: result.iterations });
    } else if (result.autoPublished) {
      log.warn("pipeline.auto_published_despite_failures", {
        issueDate,
        failing: result.failingCritics,
        iterations: result.iterations,
      });
    }
  }

  const snap = ledger.snapshot();
  const usd = estimateCostUsd(snap.totals.input, snap.totals.output);
  log.info("pipeline.done", {
    issueDate,
    status,
    iterations: result.iterations,
    wordCount,
    tokensIn: snap.totals.input,
    tokensOut: snap.totals.output,
    estUsd: usd,
  });

  return {
    issueDate,
    issueNumber,
    status,
    iterations: result.iterations,
    isShortForm: result.finalDraft.isShortForm,
    wordCount,
    failingCritics: result.failingCritics,
    cost: { inputTokens: snap.totals.input, outputTokens: snap.totals.output, calls: snap.totals.calls, usd, perStage: snap.perStage },
  };
}
