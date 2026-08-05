import { describe, expect, it } from "vitest";
import { htmlCritic } from "@/gauntlet/critics/html";
import { renderIssueHtml } from "@/render/html";
import { makeCtx, makeIngest, makeValidDraft } from "./fixtures.ts";

function render(): string {
  return renderIssueHtml({
    draft: makeValidDraft(),
    market: makeIngest().market,
    issueNumber: 1,
    issueDate: "2026-08-05",
    siteUrl: "https://example.com",
  });
}

describe("renderIssueHtml + htmlCritic", () => {
  it("renders a self-contained document that passes the HTML critic (offline)", async () => {
    const html = render();
    const v = await htmlCritic.run(makeCtx(makeValidDraft(), { html }));
    expect(v.pass).toBe(true);
    expect(html.startsWith("<!doctype html")).toBe(true);
    expect(html).toContain("<table");
    expect(html).not.toContain("<script");
  });

  it("rejects a document containing a <script>", async () => {
    const html = render().replace("</body>", "<script>alert(1)</script></body>");
    const v = await htmlCritic.run(makeCtx(makeValidDraft(), { html }));
    expect(v.pass).toBe(false);
    expect(v.violations.some((x) => /script/i.test(x.issue))).toBe(true);
  });

  it("rejects a non-https image without alt text", async () => {
    const html = render().replace("</body>", '<img src="http://x.test/a.png"></body>');
    const v = await htmlCritic.run(makeCtx(makeValidDraft(), { html }));
    expect(v.violations.some((x) => /HTTPS/i.test(x.issue))).toBe(true);
    expect(v.violations.some((x) => /alt text/i.test(x.issue))).toBe(true);
  });

  it("rejects a document missing the issue number in the footer", async () => {
    const v = await htmlCritic.run(makeCtx(makeValidDraft(), { html: render() }));
    expect(v.pass).toBe(true);
    // Wrong issue number in context → footer check fails.
    const ctx = { ...makeCtx(makeValidDraft(), { html: render() }), issueNumber: 99 };
    const v2 = await htmlCritic.run(ctx);
    expect(v2.violations.some((x) => x.location === "footer")).toBe(true);
  });
});
