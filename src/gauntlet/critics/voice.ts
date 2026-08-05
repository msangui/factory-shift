import { GAUNTLET } from "@/config/rules";
import { verdictSchema, type Critic, type GauntletContext, type Verdict } from "@/gauntlet/types";
import { criticModel, generateStructured } from "@/lib/llm";
import { avgSentenceLength } from "@/lib/util";

const VOICE_SYSTEM = `You are the VOICE CRITIC for "The Morning Shelf". You never rewrite the draft — you only judge it against a Morning Brew fidelity rubric and return a score from 0 to 10.

Score the draft on:
(a) Conversational register — contractions used, reads like a smart friend over coffee.
(b) At least 2 genuinely good quips, and ZERO forced puns.
(c) No jargon. "synergies", "leverage" (as a verb), and "ecosystem" are automatic deductions.
(d) Sentences average <= 18 words.
(e) Every section leads with the point, not the setup.

A score of 8 or above passes. For every issue you deduct for, add a violation with a precise location, the problem, and a concrete fix. Be a demanding editor: an 8+ means it genuinely sounds like Morning Brew.`;

function proseForReview(d: GauntletContext["draft"]): string {
  const parts: string[] = [`Opening: ${d.openingLine}`];
  if (d.bigStory) parts.push(`Big Story: ${d.bigStory.title}. ${d.bigStory.body} Why it matters: ${d.bigStory.whyItMatters}`);
  if (d.retailTech) parts.push(`Retail Tech: ${d.retailTech.title}. ${d.retailTech.body}`);
  if (d.cpgCorner) parts.push(`CPG Corner: ${d.cpgCorner.title}. ${d.cpgCorner.body}`);
  if (d.dealFlow) parts.push(`Deal Flow:\n${d.dealFlow.map((b) => `- ${b.text}`).join("\n")}`);
  parts.push(`Quick Hits:\n${d.quickHits.map((h) => `- ${h.text}`).join("\n")}`);
  if (d.statOfDay) parts.push(`Stat: ${d.statOfDay.stat} — ${d.statOfDay.context}`);
  parts.push(`Sign-off: ${d.signOff}`);
  return parts.join("\n\n");
}

/**
 * Voice critic (Claude call, pass = score >= 8).
 * The deterministic average sentence length is passed as a hint, but the score
 * is the model's editorial judgment.
 */
export const voiceCritic: Critic = {
  name: "voice",
  async run(ctx: GauntletContext): Promise<Verdict> {
    const prose = proseForReview(ctx.draft);
    const avg = Math.round(avgSentenceLength(prose) * 10) / 10;

    const verdict = await generateStructured({
      schema: verdictSchema,
      system: VOICE_SYSTEM,
      prompt: `Draft prose (measured average sentence length: ${avg} words):\n\n${prose}\n\nScore it and list every violation.`,
      model: criticModel(),
      stage: "critic:voice",
      maxOutputTokens: 2500,
    });

    const pass = verdict.score >= GAUNTLET.voicePassScore;
    return { pass, score: verdict.score, violations: verdict.violations };
  },
};
