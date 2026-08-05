import { factCritic } from "@/gauntlet/critics/fact";
import { financialCritic } from "@/gauntlet/critics/financial";
import { freshnessCritic } from "@/gauntlet/critics/freshness";
import { htmlCritic } from "@/gauntlet/critics/html";
import { structureCritic } from "@/gauntlet/critics/structure";
import { voiceCritic } from "@/gauntlet/critics/voice";
import { type Critic, type CriticName, type GauntletContext, type Verdict } from "@/gauntlet/types";
import { log } from "@/lib/logger";

/** All six critics. They judge; they never rewrite. */
export const CRITICS: Critic[] = [
  factCritic,
  freshnessCritic,
  voiceCritic,
  structureCritic,
  financialCritic,
  htmlCritic,
];

export interface GauntletRun {
  verdicts: Record<CriticName, Verdict>;
  passed: boolean;
  /** Failing critics with their full violation lists, for the revision prompt. */
  failing: { critic: CriticName; items: Verdict["violations"] }[];
}

/**
 * Run every critic in parallel against the same draft. A critic that throws is
 * treated as a hard failure (so an LLM/network hiccup holds the issue rather
 * than silently shipping), not a crash.
 */
export async function runGauntlet(ctx: GauntletContext): Promise<GauntletRun> {
  const results = await Promise.all(
    CRITICS.map(async (c): Promise<[CriticName, Verdict]> => {
      try {
        return [c.name, await c.run(ctx)];
      } catch (err) {
        log.error("critic.threw", { critic: c.name, error: String(err) });
        return [
          c.name,
          { pass: false, score: 0, violations: [{ location: c.name, issue: `Critic errored: ${String(err)}`, fix_suggestion: "Re-run; investigate if persistent." }] },
        ];
      }
    }),
  );

  const verdicts = Object.fromEntries(results) as Record<CriticName, Verdict>;
  const failing = results
    .filter(([, v]) => !v.pass)
    .map(([critic, v]) => ({ critic, items: v.violations }));

  return { verdicts, passed: failing.length === 0, failing };
}
