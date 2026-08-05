/**
 * Model pricing used ONLY for the per-issue cost estimate written to logs and
 * ASSUMPTIONS.md. These are placeholder rates — update them to match the actual
 * Vercel AI Gateway pricing for your chosen model. USD per 1,000,000 tokens.
 */
export const PRICING = {
  inputPerMTok: Number(process.env.PRICE_INPUT_PER_MTOK ?? "3"),
  outputPerMTok: Number(process.env.PRICE_OUTPUT_PER_MTOK ?? "15"),
} as const;

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const cost = (inputTokens / 1_000_000) * PRICING.inputPerMTok + (outputTokens / 1_000_000) * PRICING.outputPerMTok;
  return Math.round(cost * 10000) / 10000;
}
