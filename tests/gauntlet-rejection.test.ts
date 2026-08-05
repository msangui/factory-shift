import { describe, expect, it } from "vitest";
import { financialCritic } from "@/gauntlet/critics/financial";
import { freshnessCritic } from "@/gauntlet/critics/freshness";
import { structureCritic } from "@/gauntlet/critics/structure";
import { makeCtx, makeIngest, makeValidDraft } from "./fixtures.ts";

/**
 * Acceptance-criterion #2, in offline form: a deliberately corrupted draft
 * (stale story + fabricated/implausible stat + bad ticker + numberless bullet)
 * must be REJECTED by the deterministic critics. Proves the Gauntlet rejects,
 * not just approves. The Fact and Voice (LLM) critics add further coverage in a
 * live run; here we prove the offline critics alone already block the ship.
 */
describe("Gauntlet rejects a corrupted draft", () => {
  it("blocks the ship across structure, financial, and freshness", async () => {
    const ingest = makeIngest();
    ingest.candidates[0]!.ageHours = 60; // story-1 (cited by the Big Story) is now stale

    const d = makeValidDraft();
    d.bigStory!.developing = false; // 60h is over the 36h non-developing limit
    d.ticker.moverNotes[0] = { symbol: "ZZZZ", why: "fabricated mover" }; // invalid ticker
    d.statOfDay!.stat = "$9000 trillion"; // implausible magnitude
    d.dealFlow![0] = { text: "a vague deal with no number at all today", sourceUrl: "https://example.com/story-4" };

    const ctx = makeCtx(d, { ingest });
    const [structure, financial, freshness] = await Promise.all([
      structureCritic.run(ctx),
      financialCritic.run(ctx),
      freshnessCritic.run(ctx),
    ]);

    expect(structure.pass).toBe(false);
    expect(financial.pass).toBe(false);
    expect(freshness.pass).toBe(false);

    const allPassed = structure.pass && financial.pass && freshness.pass;
    expect(allPassed).toBe(false); // → the loop would REVISE or HOLD, never ship

    const totalViolations = structure.violations.length + financial.violations.length + freshness.violations.length;
    expect(totalViolations).toBeGreaterThanOrEqual(4);
  });
});
