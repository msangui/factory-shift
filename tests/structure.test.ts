import { describe, expect, it } from "vitest";
import { structureCritic, bodyWordCount } from "@/gauntlet/critics/structure";
import { makeCtx, makeValidDraft, w } from "./fixtures.ts";

describe("structureCritic", () => {
  it("passes a clean full issue", async () => {
    const v = await structureCritic.run(makeCtx(makeValidDraft()));
    expect(v.pass).toBe(true);
    expect(v.violations).toHaveLength(0);
    const words = bodyWordCount(makeValidDraft());
    expect(words).toBeGreaterThanOrEqual(600);
    expect(words).toBeLessThanOrEqual(900);
  });

  it("flags a subject over 55 characters", async () => {
    const d = makeValidDraft();
    d.subjectCandidates[0] = "This subject line is deliberately far too long to ever fit";
    const v = await structureCritic.run(makeCtx(d));
    expect(v.pass).toBe(false);
    expect(v.violations.some((x) => x.location === "subject")).toBe(true);
  });

  it("flags a Deal Flow bullet with no number", async () => {
    const d = makeValidDraft();
    d.dealFlow![0] = { text: "a big retail acquisition happened yesterday morning", sourceUrl: "https://example.com/story-4" };
    const v = await structureCritic.run(makeCtx(d));
    expect(v.violations.some((x) => x.location === "dealFlow[0]")).toBe(true);
  });

  it("flags a missing 'why it matters' line", async () => {
    const d = makeValidDraft();
    d.bigStory!.whyItMatters = "";
    const v = await structureCritic.run(makeCtx(d));
    expect(v.violations.some((x) => x.location === "bigStory.whyItMatters")).toBe(true);
  });

  it("flags a too-short Big Story", async () => {
    const d = makeValidDraft();
    d.bigStory!.body = w(50);
    const v = await structureCritic.run(makeCtx(d));
    expect(v.violations.some((x) => x.location === "bigStory.body")).toBe(true);
  });

  it("requires short-form sections to be null", async () => {
    const d = makeValidDraft();
    d.isShortForm = true; // but retailTech/dealFlow/etc are still populated
    const v = await structureCritic.run(makeCtx(d));
    expect(v.violations.some((x) => x.location === "retailTech")).toBe(true);
  });
});
