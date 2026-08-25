import { describe, expect, it } from "vitest";
import { issueDraftSchema } from "@/draft/schema";
import { makeValidDraft } from "./fixtures.ts";

/**
 * Guards the production failure where Claude's tool call returned `bigStory`
 * (and can return any nested field) as a JSON *string* instead of an object,
 * which crashed the drafter with AI_NoObjectGeneratedError. The schema now
 * coerces such stringified fields back before validating.
 */
describe("issueDraftSchema tolerant coercion", () => {
  it("accepts a normal, fully-inlined draft unchanged", () => {
    const d = makeValidDraft();
    const parsed = issueDraftSchema.parse(d);
    expect(parsed.bigStory?.title).toBe(d.bigStory!.title);
  });

  it("coerces a stringified bigStory object back into an object", () => {
    const d = makeValidDraft();
    const raw = { ...d, bigStory: JSON.stringify(d.bigStory) };
    const parsed = issueDraftSchema.parse(raw);
    expect(typeof parsed.bigStory).toBe("object");
    expect(parsed.bigStory?.whyItMatters).toBe(d.bigStory!.whyItMatters);
  });

  it("coerces stringified array and object fields (dealFlow, quickHits, ticker)", () => {
    const d = makeValidDraft();
    const raw = {
      ...d,
      dealFlow: JSON.stringify(d.dealFlow),
      quickHits: JSON.stringify(d.quickHits),
      ticker: JSON.stringify(d.ticker),
    };
    const parsed = issueDraftSchema.parse(raw);
    expect(Array.isArray(parsed.dealFlow)).toBe(true);
    expect(Array.isArray(parsed.quickHits)).toBe(true);
    expect(parsed.ticker.moverNotes.length).toBe(d.ticker.moverNotes.length);
  });

  it("still rejects a genuinely invalid draft (unparseable string stays a string)", () => {
    const d = makeValidDraft();
    const raw = { ...d, bigStory: "{ not valid json" };
    expect(() => issueDraftSchema.parse(raw)).toThrow();
  });
});
