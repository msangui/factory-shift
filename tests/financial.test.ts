import { describe, expect, it } from "vitest";
import { financialCritic } from "@/gauntlet/critics/financial";
import { makeCtx, makeValidDraft } from "./fixtures.ts";

describe("financialCritic", () => {
  it("passes a clean draft whose movers match the snapshot", async () => {
    const v = await financialCritic.run(makeCtx(makeValidDraft()));
    expect(v.pass).toBe(true);
  });

  it("flags a ticker not on the watchlist", async () => {
    const d = makeValidDraft();
    d.ticker.moverNotes[0] = { symbol: "ZZZZ", why: "made up" };
    const v = await financialCritic.run(makeCtx(d));
    expect(v.violations.some((x) => /not a watchlist ticker/.test(x.issue))).toBe(true);
  });

  it("flags a mover that is not one of today's top 3", async () => {
    const d = makeValidDraft();
    d.ticker.moverNotes[0] = { symbol: "AMZN", why: "barely moved" }; // AMZN is not a top mover in the fixture
    const v = await financialCritic.run(makeCtx(d));
    expect(v.violations.some((x) => /not one of today's top 3/.test(x.issue))).toBe(true);
  });

  it("flags a percentage that contradicts the snapshot", async () => {
    const d = makeValidDraft();
    d.ticker.moverNotes[0] = { symbol: "WMT", why: "up 9% on earnings" }; // snapshot says +3.2%
    const v = await financialCritic.run(makeCtx(d));
    expect(v.violations.some((x) => /snapshot shows/.test(x.issue))).toBe(true);
  });

  it("flags an implausible dollar magnitude", async () => {
    const d = makeValidDraft();
    d.statOfDay!.stat = "$4200 trillion";
    const v = await financialCritic.run(makeCtx(d));
    expect(v.violations.some((x) => /Implausible figure/.test(x.issue))).toBe(true);
  });
});
