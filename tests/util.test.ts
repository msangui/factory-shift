import { describe, expect, it } from "vitest";
import { avgSentenceLength, containsNumber, countWords, normalizeTitle, normalizeUrl, truncate } from "@/lib/util";
import { parseMoney } from "@/gauntlet/critics/financial";

describe("util", () => {
  it("counts words", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  ")).toBe(0);
  });

  it("detects numbers", () => {
    expect(containsNumber("up 4%")).toBe(true);
    expect(containsNumber("no digits here")).toBe(false);
  });

  it("normalizes urls (strips tracking + trailing slash)", () => {
    expect(normalizeUrl("https://Example.com/a/?utm_source=x")).toBe("https://example.com/a");
    expect(normalizeUrl("https://example.com/a#frag")).toBe("https://example.com/a");
  });

  it("normalizes titles", () => {
    expect(normalizeTitle("Walmart's Q3: +4%!")).toBe("walmart s q3 4");
  });

  it("computes average sentence length", () => {
    expect(avgSentenceLength("a b c. d e.")).toBeCloseTo(2.5, 1);
  });

  it("truncates on a word boundary", () => {
    expect(truncate("one two three four", 8)).toBe("one two…");
  });
});

describe("parseMoney", () => {
  it("parses magnitudes", () => {
    expect(parseMoney("$4.2B")).toBe(4.2e9);
    expect(parseMoney("$500 million")).toBe(5e8);
    expect(parseMoney("$3,000")).toBe(3000);
  });
  it("rejects malformed", () => {
    expect(parseMoney("$abc")).toBeNull();
  });
});
