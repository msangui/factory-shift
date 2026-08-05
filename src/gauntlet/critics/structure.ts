import { LENGTHS } from "@/config/rules";
import { countWords, containsNumber } from "@/lib/util";
import { type Critic, type GauntletContext, type Verdict, type Violation } from "@/gauntlet/types";

/**
 * Structure critic (deterministic, pass = zero violations).
 * Section ORDER is guaranteed by the schema + renderer, so this checks
 * presence, word counts, subject length, Deal Flow numbers, and the Big Story
 * "why it matters" line. Deterministic because word-counting and length checks
 * are more reliable in code than in a model call (see ASSUMPTIONS.md).
 */
export const structureCritic: Critic = {
  name: "structure",
  async run(ctx: GauntletContext): Promise<Verdict> {
    const v: Violation[] = [];
    const d = ctx.draft;
    const short = d.isShortForm;

    // Subject + preview.
    if (d.subjectCandidates.length !== 2) {
      v.push({ location: "subjectCandidates", issue: "Need exactly 2 subject candidates.", fix_suggestion: "Provide two subject lines." });
    }
    const chosen = d.subjectCandidates[d.chosenSubjectIndex];
    if (!chosen) {
      v.push({ location: "chosenSubjectIndex", issue: "chosenSubjectIndex does not point at a candidate.", fix_suggestion: "Set index to 0 or 1." });
    } else if (chosen.length > LENGTHS.subjectMaxChars) {
      v.push({ location: "subject", issue: `Chosen subject is ${chosen.length} chars (max ${LENGTHS.subjectMaxChars}).`, fix_suggestion: "Shorten the subject line." });
    }
    for (let i = 0; i < d.subjectCandidates.length; i++) {
      const s = d.subjectCandidates[i]!;
      if (s.length > LENGTHS.subjectMaxChars) {
        v.push({ location: `subject candidate ${i + 1}`, issue: `Candidate is ${s.length} chars (max ${LENGTHS.subjectMaxChars}).`, fix_suggestion: "Shorten it." });
      }
    }
    if (!d.previewText.trim()) v.push({ location: "previewText", issue: "Missing preview text.", fix_suggestion: "Add inbox preview text." });
    if (!d.openingLine.trim()) v.push({ location: "openingLine", issue: "Missing opening line.", fix_suggestion: "Add one witty sentence." });

    // The Ticker.
    if (d.ticker.moverNotes.length > LENGTHS.topMovers) {
      v.push({ location: "ticker.moverNotes", issue: `Too many mover notes (${d.ticker.moverNotes.length} > ${LENGTHS.topMovers}).`, fix_suggestion: "Keep to the top 3 movers." });
    }

    // Big Story (required in both modes).
    if (!d.bigStory) {
      v.push({ location: "bigStory", issue: "Big Story is missing.", fix_suggestion: "Write the lead story." });
    } else {
      checkWords(v, "bigStory.body", d.bigStory.body, LENGTHS.bigStoryWords);
      if (!d.bigStory.whyItMatters.trim()) {
        v.push({ location: "bigStory.whyItMatters", issue: "Missing 'why it matters' line.", fix_suggestion: "End the Big Story with why it matters." });
      }
    }

    if (short) {
      // Short-form: these must be absent.
      for (const [k, val] of [["retailTech", d.retailTech], ["cpgCorner", d.cpgCorner], ["dealFlow", d.dealFlow], ["statOfDay", d.statOfDay]] as const) {
        if (val) v.push({ location: k, issue: `${k} must be null in a short-form issue.`, fix_suggestion: `Set ${k} to null.` });
      }
    } else {
      // Full issue: all sections required within counts.
      if (!d.retailTech) v.push({ location: "retailTech", issue: "Missing Retail Tech.", fix_suggestion: "Add the Retail Tech section." });
      else checkWords(v, "retailTech.body", d.retailTech.body, LENGTHS.retailTechWords);

      if (!d.cpgCorner) v.push({ location: "cpgCorner", issue: "Missing CPG Corner.", fix_suggestion: "Add the CPG Corner section." });
      else checkWords(v, "cpgCorner.body", d.cpgCorner.body, LENGTHS.cpgCornerWords);

      if (!d.dealFlow || d.dealFlow.length < LENGTHS.dealFlowBullets.min || d.dealFlow.length > LENGTHS.dealFlowBullets.max) {
        v.push({ location: "dealFlow", issue: `Deal Flow must have ${LENGTHS.dealFlowBullets.min}–${LENGTHS.dealFlowBullets.max} bullets.`, fix_suggestion: "Adjust the bullet count." });
      }
      if (d.dealFlow) {
        d.dealFlow.forEach((b, i) => {
          if (!containsNumber(b.text)) v.push({ location: `dealFlow[${i}]`, issue: "Bullet has no hard number.", fix_suggestion: "Include a specific figure." });
          if (countWords(b.text) > LENGTHS.dealFlowWordsPerBullet.max) v.push({ location: `dealFlow[${i}]`, issue: `Bullet exceeds ${LENGTHS.dealFlowWordsPerBullet.max} words.`, fix_suggestion: "Trim the bullet." });
        });
      }

      if (!d.statOfDay) v.push({ location: "statOfDay", issue: "Missing Stat of the Day.", fix_suggestion: "Add one number with one sentence of context." });
    }

    // Quick Hits (both modes).
    if (d.quickHits.length < LENGTHS.quickHits.min || d.quickHits.length > LENGTHS.quickHits.max) {
      v.push({ location: "quickHits", issue: `Quick Hits must have ${LENGTHS.quickHits.min}–${LENGTHS.quickHits.max} items.`, fix_suggestion: "Adjust the count." });
    }
    if (!d.signOff.trim()) v.push({ location: "signOff", issue: "Missing sign-off.", fix_suggestion: "Add one line of personality." });

    // Total body length.
    const words = bodyWordCount(d);
    if (words > LENGTHS.bodyWords.hardCap) {
      v.push({ location: "total", issue: `Body is ${words} words; hard cap is ${LENGTHS.bodyWords.hardCap}.`, fix_suggestion: "Cut copy." });
    }
    if (!short && (words < LENGTHS.bodyWords.min || words > LENGTHS.bodyWords.max)) {
      v.push({ location: "total", issue: `Body is ${words} words; target is ${LENGTHS.bodyWords.min}–${LENGTHS.bodyWords.max}.`, fix_suggestion: words < LENGTHS.bodyWords.min ? "Add substance." : "Trim copy." });
    }

    const score = v.length === 0 ? 10 : Math.max(0, 10 - v.length);
    return { pass: v.length === 0, score, violations: v };
  },
};

function checkWords(v: Violation[], loc: string, text: string, range: { min: number; max: number }): void {
  const n = countWords(text);
  if (n < range.min || n > range.max) {
    v.push({ location: loc, issue: `${loc} is ${n} words; must be ${range.min}–${range.max}.`, fix_suggestion: n < range.min ? "Expand it." : "Tighten it." });
  }
}

/** Approximate "body copy" word count: prose the reader actually reads. */
export function bodyWordCount(d: GauntletContext["draft"]): number {
  let n = countWords(d.openingLine);
  n += d.ticker.moverNotes.reduce((s, m) => s + countWords(m.why), 0);
  if (d.bigStory) n += countWords(d.bigStory.body) + countWords(d.bigStory.whyItMatters);
  if (d.retailTech) n += countWords(d.retailTech.body);
  if (d.cpgCorner) n += countWords(d.cpgCorner.body);
  if (d.dealFlow) n += d.dealFlow.reduce((s, b) => s + countWords(b.text), 0);
  n += d.quickHits.reduce((s, h) => s + countWords(h.text), 0);
  if (d.statOfDay) n += countWords(d.statOfDay.context);
  n += countWords(d.signOff);
  return n;
}
