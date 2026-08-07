/**
 * Colour palette for the rendered issue, sourced from the "Issue Email v2"
 * visual design (Claude Design project c42cae61-b48d-4a1a-9de9-de28e3c9f67c).
 *
 * Dark-mode strategy: the spec asks for "all CSS inline" AND "dark-mode-safe
 * colours". A <style> block with @media (prefers-color-scheme) would be the
 * usual way, but that is not inline and email-client support is uneven and
 * destructive (some clients force-invert regardless). So we commit to a single
 * palette applied via inline styles that stays legible whether a client shows
 * it as-is or force-inverts it: real backgrounds on every container (never
 * transparent), mid-contrast text (not pure #000 on #fff), and visible borders
 * so structure survives inversion. Recorded in ASSUMPTIONS.md.
 */
export const THEME = {
  pageBg: "#F0F1EC",
  cardBg: "#FFFFFF",
  /** Outer card + decorative image borders. */
  cardBorder: "#DFE1D9",
  /** Internal row/section dividers. */
  rule: "#E7E9E1",
  ink: "#1A1C16",
  muted: "#6B6F63",
  /** Links, the back-to-archive breadcrumb, the masthead accent mark. */
  accent: "#6E8A0F",
  /** Section-label pill background; pairs with `ink` for the pill's text. */
  badgeBg: "#C6DA3E",
  tickerUp: "#1D7A4C",
  tickerDown: "#B23A2E",
  /** Stat of the Day's big number — distinct from `accent` so it reads as data, not a link. */
  statAccent: "#5D7A0C",
  /** Fill for the decorative per-section image (see sectionImage() in html.ts). */
  imageBg: "#EDEFE4",
  fontStack:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;
