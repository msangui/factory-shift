import { type Critic, type GauntletContext, type Verdict, type Violation } from "@/gauntlet/types";

const RESOURCE_TAG_RE = /<(script|iframe|object|embed|video|audio|source|link)\b[^>]*>/gi;
const IMG_RE = /<img\b[^>]*>/gi;
const HREF_RE = /href\s*=\s*"([^"]+)"/gi;

/**
 * HTML critic (deterministic, pass = zero violations).
 * Validates the rendered document is self-contained, table-based, inline-CSS,
 * script-free, 600px, dark-mode-legible, with a footer web link + issue number.
 * When `ctx.live`, it also HEAD-checks every outbound link (bot-blocked 401/403/
 * 405 count as reachable — see ASSUMPTIONS.md; only 404/410/gone or network
 * failures are violations).
 */
export const htmlCritic: Critic = {
  name: "html",
  async run(ctx: GauntletContext): Promise<Verdict> {
    const v: Violation[] = [];
    const html = ctx.html;
    const lower = html.toLowerCase();

    if (!lower.startsWith("<!doctype html")) v.push({ location: "html", issue: "Document does not start with <!doctype html>.", fix_suggestion: "Emit a full HTML document." });
    if (!lower.includes("<html")) v.push({ location: "html", issue: "Missing <html> element.", fix_suggestion: "Wrap the document in <html>." });
    if (!lower.includes("<body")) v.push({ location: "html", issue: "Missing <body> element.", fix_suggestion: "Add a <body>." });
    if ((lower.match(/<html/g)?.length ?? 0) > 1) v.push({ location: "html", issue: "More than one document (multiple <html>).", fix_suggestion: "Emit a single self-contained document." });

    if (!lower.includes("<table")) v.push({ location: "html", issue: "No table-based layout found.", fix_suggestion: "Use table layout for email." });
    if (lower.includes("<script")) v.push({ location: "html", issue: "Contains a <script> tag.", fix_suggestion: "Remove all JavaScript." });
    if (lower.includes("<style")) v.push({ location: "html", issue: "Contains a <style> block; CSS must be inline.", fix_suggestion: "Move styles to inline style attributes." });
    if (/<link\b[^>]*stylesheet/i.test(html)) v.push({ location: "html", issue: "External stylesheet <link> present.", fix_suggestion: "Inline all CSS." });

    // No external resources except images (which need https + alt).
    for (const m of html.matchAll(RESOURCE_TAG_RE)) {
      const tag = (m[1] ?? "").toLowerCase();
      if (tag === "link" && /stylesheet/i.test(m[0])) continue; // already flagged
      v.push({ location: "html", issue: `Disallowed resource tag <${tag}>.`, fix_suggestion: `Remove the <${tag}> element.` });
    }
    for (const m of html.matchAll(IMG_RE)) {
      const tag = m[0];
      const src = tag.match(/src\s*=\s*"([^"]+)"/i)?.[1] ?? "";
      // data: images are self-contained (no external fetch at all), so they're
      // strictly more robust than an https:// URL, not less — allowed alongside it.
      if (!/^https:\/\//i.test(src) && !/^data:image\//i.test(src)) {
        v.push({ location: "img", issue: `Image src is not absolute HTTPS or a data: URI: '${src}'.`, fix_suggestion: "Use an absolute https:// image URL or a self-contained data:image/ URI." });
      }
      if (!/alt\s*=\s*"/i.test(tag)) v.push({ location: "img", issue: "Image missing alt text.", fix_suggestion: "Add an alt attribute." });
    }
    // No http:// resource references inside inline styles (e.g. background url()).
    if (/url\(\s*['"]?http:/i.test(html)) v.push({ location: "html", issue: "Inline style loads an external http resource.", fix_suggestion: "Remove external url() references." });

    // 600px width.
    if (!(/width\s*=\s*"600"/i.test(html) || /max-width:\s*600px/i.test(html))) {
      v.push({ location: "html", issue: "No 600px width constraint found.", fix_suggestion: "Constrain the container to 600px." });
    }

    // Dark-mode legibility: body must set an explicit background, and text colours must be explicit.
    if (!/<body[^>]*background-color:/i.test(html)) {
      v.push({ location: "body", issue: "Body has no explicit background-color (dark-mode risk).", fix_suggestion: "Set an explicit background on the body." });
    }

    // Footer: web-version link + issue number.
    if (!/\/issues\//i.test(html)) v.push({ location: "footer", issue: "No web-version link (/issues/...) found.", fix_suggestion: "Add a link to the web version." });
    if (!new RegExp(`issue\\s*#\\s*${ctx.issueNumber}\\b`, "i").test(html)) {
      v.push({ location: "footer", issue: `Footer does not state issue #${ctx.issueNumber}.`, fix_suggestion: "Include the issue number in the footer." });
    }

    // Live link resolution.
    if (ctx.live) {
      const urls = extractHttpLinks(html);
      const results = await headCheckAll(urls);
      for (const r of results) {
        if (!r.ok) v.push({ location: "link", issue: `Link does not resolve (${r.reason}): ${r.url}`, fix_suggestion: "Fix or remove the broken link." });
      }
    }

    const score = v.length === 0 ? 10 : Math.max(0, 10 - v.length);
    return { pass: v.length === 0, score, violations: v };
  },
};

export function extractHttpLinks(html: string): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(HREF_RE)) {
    const href = m[1] ?? "";
    if (/^https?:\/\//i.test(href) && !/localhost|127\.0\.0\.1/i.test(href)) set.add(href);
  }
  return [...set];
}

interface HeadResult {
  url: string;
  ok: boolean;
  reason: string;
}

async function headCheckAll(urls: string[]): Promise<HeadResult[]> {
  const CONCURRENCY = 5;
  const out: HeadResult[] = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx]!;
      out.push(await headCheck(url));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  return out;
}

async function headCheck(url: string): Promise<HeadResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal, headers: { "user-agent": "MorningShelfBot/0.1" } });
    // Some servers reject HEAD; retry with a lightweight GET.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "user-agent": "MorningShelfBot/0.1", range: "bytes=0-0" } });
    }
    // Bot-blocking answers still prove the link resolves to a real host.
    if (res.ok || [401, 403, 405, 429].includes(res.status)) return { url, ok: true, reason: String(res.status) };
    return { url, ok: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    return { url, ok: false, reason: String(err) };
  } finally {
    clearTimeout(timer);
  }
}
