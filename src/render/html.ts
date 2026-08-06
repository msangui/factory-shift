import { BRAND } from "@/config/brand";
import type { IssueDraft } from "@/draft/schema";
import type { MarketSnapshot, Quote } from "@/ingest/types";
import { THEME } from "@/render/theme";

/** HTML-escape text destined for element content or attribute values. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function link(url: string, label: string): string {
  return `<a href="${esc(url)}" style="color:${THEME.accent};text-decoration:underline;">${esc(label)}</a>`;
}

function sectionHeading(emoji: string, title: string): string {
  return `<div style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${THEME.accent};margin:0 0 6px 0;">${emoji} ${esc(title)}</div>`;
}

function row(inner: string): string {
  return `<tr><td style="padding:18px 24px;border-bottom:1px solid ${THEME.rule};">${inner}</td></tr>`;
}

function fmtChange(pct: number | null): { text: string; color: string } {
  if (pct === null) return { text: "—", color: THEME.muted };
  const sign = pct > 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(2)}%`, color: pct >= 0 ? THEME.tickerUp : THEME.tickerDown };
}

function renderTicker(draft: IssueDraft, market: MarketSnapshot): string {
  // Wrapping chips (inline-block), not a single-row table, so the bar reflows on
  // narrow screens instead of forcing horizontal scroll.
  const chips = market.quotes
    .map((q: Quote) => {
      const c = fmtChange(q.changePct);
      return `<span style="display:inline-block;white-space:nowrap;margin:0 14px 6px 0;font-size:13px;color:${THEME.ink};"><strong>${esc(q.symbol)}</strong> <span style="color:${c.color};">${c.text}</span></span>`;
    })
    .join("");

  const whyBySymbol = new Map(draft.ticker.moverNotes.map((m) => [m.symbol.toUpperCase(), m.why]));
  const moverLines = market.topMoverSymbols
    .map((sym) => {
      const q = market.quotes.find((x) => x.symbol === sym);
      const why = whyBySymbol.get(sym.toUpperCase());
      if (!q) return "";
      const c = fmtChange(q.changePct);
      const arrow = (q.changePct ?? 0) >= 0 ? "▲" : "▼";
      const whyText = why ? ` — ${esc(why)}` : "";
      return `<div style="font-size:14px;color:${THEME.ink};margin-top:4px;"><span style="color:${c.color};">${arrow} ${esc(q.name)} ${c.text}</span>${whyText}</div>`;
    })
    .filter(Boolean)
    .join("");

  return (
    sectionHeading("📊", "The Ticker") +
    `<div style="line-height:1.7;">${chips}</div>` +
    (moverLines ? `<div style="margin-top:8px;">${moverLines}</div>` : "")
  );
}

function paragraph(text: string): string {
  return `<div style="font-size:15px;line-height:1.55;color:${THEME.ink};">${esc(text)}</div>`;
}

/** Render one issue to a single self-contained, email-safe HTML document. */
export function renderIssueHtml(input: {
  draft: IssueDraft;
  market: MarketSnapshot;
  issueNumber: number;
  issueDate: string;
  siteUrl: string;
}): string {
  const { draft, market, issueNumber, issueDate, siteUrl } = input;
  const subject = draft.subjectCandidates[draft.chosenSubjectIndex] ?? draft.subjectCandidates[0] ?? BRAND.name;
  const webUrl = `${siteUrl.replace(/\/$/, "")}/issues/${issueDate}`;
  const archiveUrl = siteUrl.replace(/\/$/, "");

  const rows: string[] = [];

  // Masthead (text only — no external images).
  rows.push(
    `<tr><td style="padding:24px 24px 12px 24px;">
      <div style="font-size:22px;font-weight:800;color:${THEME.ink};">${esc(BRAND.name)}</div>
      <div style="font-size:12px;color:${THEME.muted};margin-top:2px;">${esc(BRAND.tagline)} · Issue #${issueNumber} · ${esc(issueDate)}${draft.isShortForm ? " · Short-form" : ""}</div>
    </td></tr>`,
  );

  // Opening line.
  rows.push(row(`<div style="font-size:16px;line-height:1.5;color:${THEME.ink};">☕ ${esc(draft.openingLine)}</div>`));

  // The Ticker.
  rows.push(row(renderTicker(draft, market)));

  // Big Story.
  if (draft.bigStory) {
    const bs = draft.bigStory;
    const readMore = bs.sourceUrls[0] ? ` ${link(bs.sourceUrls[0], "Read more →")}` : "";
    rows.push(
      row(
        sectionHeading("🛒", "The Big Story") +
          `<div style="font-size:17px;font-weight:700;color:${THEME.ink};margin-bottom:6px;">${esc(bs.title)}</div>` +
          paragraph(bs.body) +
          `<div style="font-size:14px;line-height:1.5;color:${THEME.ink};margin-top:10px;"><strong>Why it matters:</strong> ${esc(bs.whyItMatters)}${readMore}</div>`,
      ),
    );
  }

  // Retail Tech.
  if (draft.retailTech) {
    const s = draft.retailTech;
    const readMore = s.sourceUrls[0] ? ` ${link(s.sourceUrls[0], "Read more →")}` : "";
    rows.push(
      row(
        sectionHeading("🤖", "Retail Tech") +
          `<div style="font-size:15px;font-weight:700;color:${THEME.ink};margin-bottom:6px;">${esc(s.title)}</div>` +
          paragraph(s.body) +
          `<div style="margin-top:6px;font-size:14px;">${readMore}</div>`,
      ),
    );
  }

  // CPG Corner.
  if (draft.cpgCorner) {
    const s = draft.cpgCorner;
    const readMore = s.sourceUrls[0] ? ` ${link(s.sourceUrls[0], "Read more →")}` : "";
    rows.push(
      row(
        sectionHeading("🧴", "CPG Corner") +
          `<div style="font-size:15px;font-weight:700;color:${THEME.ink};margin-bottom:6px;">${esc(s.title)}</div>` +
          paragraph(s.body) +
          `<div style="margin-top:6px;font-size:14px;">${readMore}</div>`,
      ),
    );
  }

  // Deal Flow & Earnings.
  if (draft.dealFlow && draft.dealFlow.length > 0) {
    const items = draft.dealFlow
      .map((b) => `<li style="margin:0 0 6px 0;">${esc(b.text)} ${link(b.sourceUrl, "↗")}</li>`)
      .join("");
    rows.push(
      row(
        sectionHeading("💸", "Deal Flow & Earnings") +
          `<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.5;color:${THEME.ink};">${items}</ul>`,
      ),
    );
  }

  // Quick Hits.
  if (draft.quickHits.length > 0) {
    const items = draft.quickHits
      .map((h) => `<li style="margin:0 0 6px 0;">${esc(h.text)} ${link(h.sourceUrl, "↗")}</li>`)
      .join("");
    rows.push(
      row(
        sectionHeading("⚡", "Quick Hits") +
          `<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.5;color:${THEME.ink};">${items}</ul>`,
      ),
    );
  }

  // Stat of the Day.
  if (draft.statOfDay) {
    const st = draft.statOfDay;
    rows.push(
      row(
        sectionHeading("📈", "Stat of the Day") +
          `<div style="font-size:26px;font-weight:800;color:${THEME.accent};">${esc(st.stat)}</div>` +
          `<div style="font-size:15px;line-height:1.5;color:${THEME.ink};margin-top:4px;">${esc(st.context)} ${link(st.sourceUrl, "↗")}</div>`,
      ),
    );
  }

  // Sign-off + footer.
  rows.push(
    `<tr><td style="padding:20px 24px 8px 24px;">
      <div style="font-size:15px;color:${THEME.ink};">${esc(draft.signOff)}</div>
    </td></tr>`,
  );
  rows.push(
    `<tr><td style="padding:8px 24px 28px 24px;">
      <div style="font-size:12px;color:${THEME.muted};line-height:1.6;">
        You're reading issue #${issueNumber} of ${esc(BRAND.name)}.<br/>
        ${link(webUrl, "View this issue on the web")} · ${link(archiveUrl, "Browse the archive")}
      </div>
    </td></tr>`,
  );

  const body = rows.join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light dark"/>
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${THEME.pageBg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(draft.previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${THEME.pageBg};">
  <tr>
    <td align="center" style="padding:16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:${THEME.cardBg};border:1px solid ${THEME.rule};border-radius:8px;font-family:${THEME.fontStack};">
${body}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
