import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, type LanguageModel } from "ai";
import type { z } from "zod";
import { log } from "@/lib/logger";

/**
 * Claude, two ways:
 *
 *  - If `ANTHROPIC_API_KEY` is set, call the Anthropic API **directly** via the
 *    AI SDK's Anthropic provider. Inference bills to your Anthropic account and
 *    the Vercel AI Gateway (and its card-on-file requirement) is bypassed.
 *  - Otherwise, route a bare `provider/model` string through the **Vercel AI
 *    Gateway** (`AI_GATEWAY_API_KEY`, or OIDC on Vercel) — the original path.
 *
 * `MODEL_DRAFTER` / `MODEL_CRITIC` override the model. Use a native Anthropic id
 * for the direct path (e.g. `claude-sonnet-4-5`); a leading `anthropic/` is
 * stripped for you. For the Gateway path the provider prefix is added if absent.
 */
const DEFAULT_MODEL = "claude-sonnet-4-5";

function resolveModel(rawId: string): LanguageModel {
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic(rawId.replace(/^anthropic\//, ""));
  }
  return rawId.includes("/") ? rawId : `anthropic/${rawId}`;
}

export function drafterModel(): LanguageModel {
  return resolveModel(process.env.MODEL_DRAFTER || DEFAULT_MODEL);
}

export function criticModel(): LanguageModel {
  return resolveModel(process.env.MODEL_CRITIC || DEFAULT_MODEL);
}

/** Accumulates token usage per pipeline stage for the per-issue cost estimate. */
export class TokenLedger {
  private stages: Record<string, { input: number; output: number; calls: number }> = {};

  add(stage: string, input: number, output: number): void {
    const cur = this.stages[stage] ?? { input: 0, output: 0, calls: 0 };
    cur.input += input;
    cur.output += output;
    cur.calls += 1;
    this.stages[stage] = cur;
  }

  snapshot() {
    const perStage = Object.entries(this.stages).map(([stage, v]) => ({ stage, ...v }));
    const totals = perStage.reduce(
      (acc, s) => ({
        input: acc.input + s.input,
        output: acc.output + s.output,
        calls: acc.calls + s.calls,
      }),
      { input: 0, output: 0, calls: 0 },
    );
    return { perStage, totals };
  }
}

/**
 * Structured generation with a Zod schema. Every critic verdict and the issue
 * draft come through here, so the schema is validated at the SDK layer and the
 * model retries on a shape mismatch.
 */
export async function generateStructured<T>(opts: {
  // Input type is `unknown` so schemas wrapped in z.preprocess (whose input is
  // widened) still infer T from their output shape, not their input.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  system: string;
  prompt: string;
  model: LanguageModel;
  stage: string;
  ledger?: TokenLedger;
  /** Lower for terse verdicts, higher for the full draft. */
  maxOutputTokens?: number;
  /** How many times to try before giving up (default 2). */
  attempts?: number;
  /** Temperature for the first attempt; later attempts escalate from here. */
  baseTemperature?: number;
}): Promise<T> {
  const maxAttempts = opts.attempts ?? 2;
  const baseTemp = opts.baseTemperature ?? 0.4;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Escalate temperature on each retry. For a large nested schema, Claude's
    // tool call sometimes mis-serializes a section (emits a nested object as a
    // string, or wraps the whole draft under one key) — and at a low, near-
    // deterministic temperature the retries reproduce the same bad output.
    // Resampling hotter breaks that loop; a clean first attempt never pays it.
    const temperature = Math.min(1, baseTemp + (attempt - 1) * 0.3);
    try {
      const { object, usage } = await generateObject({
        model: opts.model,
        schema: opts.schema,
        system: opts.system,
        prompt: opts.prompt,
        maxOutputTokens: opts.maxOutputTokens ?? 4096,
        temperature,
      });

      const input = usage?.inputTokens ?? 0;
      const output = usage?.outputTokens ?? 0;
      opts.ledger?.add(opts.stage, input, output);
      log.debug("llm.generateStructured", { stage: opts.stage, input, output, attempt, temperature });

      return object;
    } catch (err) {
      // Structured-output coercion can transiently fail (truncation, a stray
      // wrapper, a mis-serialized section). Retry — hotter — before letting the
      // error propagate to the caller.
      lastErr = err;
      log.warn("llm.retry", { stage: opts.stage, attempt, temperature, error: String(err) });
    }
  }

  throw lastErr;
}
