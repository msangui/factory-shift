import { describe, expect, it } from "vitest";
import { freshnessCritic } from "@/gauntlet/critics/freshness";
import { makeCtx, makeIngest, makeValidDraft } from "./fixtures.ts";

describe("freshnessCritic", () => {
  it("passes when every source is within the window", async () => {
    const v = await freshnessCritic.run(makeCtx(makeValidDraft()));
    expect(v.pass).toBe(true);
  });

  it("flags a Big Story source older than 36h when not developing", async () => {
    const ingest = makeIngest();
    ingest.candidates[0]!.ageHours = 50; // story-1, cited by the Big Story
    const d = makeValidDraft();
    d.bigStory!.developing = false;
    const v = await freshnessCritic.run(makeCtx(d, { ingest }));
    expect(v.pass).toBe(false);
    expect(v.violations.some((x) => x.location === "bigStory")).toBe(true);
  });

  it("allows a developing Big Story up to 72h", async () => {
    const ingest = makeIngest();
    ingest.candidates[0]!.ageHours = 50;
    const d = makeValidDraft();
    d.bigStory!.developing = true;
    const v = await freshnessCritic.run(makeCtx(d, { ingest }));
    expect(v.violations.some((x) => x.location === "bigStory")).toBe(false);
  });

  it("flags a source that is not in the ingest window at all", async () => {
    const d = makeValidDraft();
    d.shopFloor!.sourceUrls = ["https://example.com/not-ingested"];
    const v = await freshnessCritic.run(makeCtx(d));
    expect(v.violations.some((x) => x.location === "shopFloor")).toBe(true);
  });
});
