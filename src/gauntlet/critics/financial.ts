import { WATCHLIST_SYMBOLS } from "@/config/watchlist";
import { type Critic, type GauntletContext, type Verdict, type Violation } from "@/gauntlet/types";

/**
 * Financial critic (deterministic, pass = zero violations).
 * Ticker symbols valid and drawn from the snapshot's actual top movers; any
 * percentage the model slipped into a mover note matches the snapshot; dollar
 * magnitudes are well-formed and sane ($4.2B vs $4.2M). Deeper metric/period
 * labeling (revenue vs net income, Q vs FY) is cross-checked by the Fact critic
 * against sources — see ASSUMPTIONS.md.
 */
export const financialCritic: Critic = {
  name: "financial",
  async run(ctx: GauntletContext): Promise<Verdict> {
    const v: Violation[] = [];
    const d = ctx.draft;
    const snapshot = ctx.ingest.market;
    const topMovers = new Set(snapshot.topMoverSymbols.map((s) => s.toUpperCase()));
    const changeBySymbol = new Map(snapshot.quotes.map((q) => [q.symbol.toUpperCase(), q.changePct]));

    d.ticker.moverNotes.forEach((m, i) => {
      const sym = m.symbol.toUpperCase();
      if (!WATCHLIST_SYMBOLS.includes(sym)) {
        v.push({ location: `ticker.moverNotes[${i}]`, issue: `'${m.symbol}' is not a watchlist ticker.`, fix_suggestion: "Use a symbol from the watchlist snapshot." });
        return;
      }
      if (topMovers.size > 0 && !topMovers.has(sym)) {
        v.push({ location: `ticker.moverNotes[${i}]`, issue: `${sym} is not one of today's top 3 movers.`, fix_suggestion: `Comment only on: ${[...topMovers].join(", ")}.` });
      }
      // The model shouldn't include numbers in the 'why'; if it did, it must match the snapshot.
      const pct = extractPercent(m.why);
      const actual = changeBySymbol.get(sym);
      if (pct !== null && actual !== null && actual !== undefined && Math.abs(pct - actual) > 0.1) {
        v.push({ location: `ticker.moverNotes[${i}]`, issue: `Stated ${pct}% for ${sym} but the snapshot shows ${actual}%.`, fix_suggestion: "Drop the number; the system inserts the real figure." });
      }
    });

    // Dollar-magnitude sanity across all prose.
    for (const [loc, text] of collectText(d)) {
      for (const m of text.matchAll(MONEY_RE)) {
        const value = parseMoney(m[0]);
        if (value === null) {
          v.push({ location: loc, issue: `Malformed money figure '${m[0].trim()}'.`, fix_suggestion: "Use a clean figure like $4.2B." });
        } else if (value > 1e14) {
          v.push({ location: loc, issue: `Implausible figure '${m[0].trim()}' (> $100T).`, fix_suggestion: "Check units — likely a $B vs $M/$T slip." });
        }
      }
    }

    const score = v.length === 0 ? 10 : Math.max(0, 10 - v.length);
    return { pass: v.length === 0, score, violations: v };
  },
};

const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:trillion|billion|million|thousand|bn|mn|[bmkt])?\b/gi;

function extractPercent(text: string): number | null {
  const m = text.match(/([+-]?\d+(?:\.\d+)?)\s?%/);
  return m && m[1] ? Number.parseFloat(m[1]) : null;
}

/** Parse a money string to an absolute USD number; null if malformed. */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/\$|,|\s/g, "").toLowerCase();
  const m = cleaned.match(/^(\d+(?:\.\d+)?)(trillion|billion|million|thousand|bn|mn|[bmkt])?$/);
  if (!m || !m[1]) return null;
  const base = Number.parseFloat(m[1]);
  if (!Number.isFinite(base)) return null;
  const unit = m[2];
  const mult: Record<string, number> = {
    k: 1e3, thousand: 1e3,
    m: 1e6, mn: 1e6, million: 1e6,
    b: 1e9, bn: 1e9, billion: 1e9,
    t: 1e12, trillion: 1e12,
  };
  return base * (unit ? (mult[unit] ?? 1) : 1);
}

/** All model-authored prose fields with a location label. */
function collectText(d: GauntletContext["draft"]): [string, string][] {
  const out: [string, string][] = [];
  out.push(["openingLine", d.openingLine]);
  if (d.bigStory) {
    out.push(["bigStory.body", d.bigStory.body], ["bigStory.whyItMatters", d.bigStory.whyItMatters]);
  }
  if (d.shopFloor) out.push(["shopFloor.body", d.shopFloor.body]);
  if (d.oemCorner) out.push(["oemCorner.body", d.oemCorner.body]);
  if (d.dealFlow) d.dealFlow.forEach((b, i) => out.push([`dealFlow[${i}]`, b.text]));
  d.quickHits.forEach((h, i) => out.push([`quickHits[${i}]`, h.text]));
  if (d.statOfDay) out.push(["statOfDay.stat", d.statOfDay.stat], ["statOfDay.context", d.statOfDay.context]);
  return out;
}
