import { generateObject } from "ai";
import type { z } from "zod";
import { log } from "@/lib/logger";

/**
 * Claude via the Vercel AI Gateway.
 *
 * The AI SDK routes a bare `provider/model` string through the AI Gateway when
 * `AI_GATEWAY_API_KEY` is set (or, on Vercel, via OIDC). We never import a
 * provider SDK directly — the gateway is the single egress point, per spec.
 */
export function drafterModel(): string {
  return process.env.MODEL_DRAFTER ?? "anthropic/claude-sonnet-4.5";
}

export function criticModel(): string {
  return process.env.MODEL_CRITIC ?? "anthropic/claude-sonnet-4.5";
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
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  model: string;
  stage: string;
  ledger?: TokenLedger;
  /** Lower for terse verdicts, higher for the full draft. */
  maxOutputTokens?: number;
}): Promise<T> {
  const { object, usage } = await generateObject({
    model: opts.model,
    schema: opts.schema,
    system: opts.system,
    prompt: opts.prompt,
    maxOutputTokens: opts.maxOutputTokens ?? 4096,
    // Deterministic-leaning; the drafter overrides via prompt where variety helps.
    temperature: 0.4,
  });

  const input = usage?.inputTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  opts.ledger?.add(opts.stage, input, output);
  log.debug("llm.generateStructured", { stage: opts.stage, model: opts.model, input, output });

  return object;
}
