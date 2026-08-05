/**
 * Colour palette for the rendered issue.
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
  pageBg: "#f4f1ea",
  cardBg: "#ffffff",
  ink: "#20242c",
  muted: "#5b6270",
  accent: "#b3541e",
  accentInk: "#ffffff",
  rule: "#e2ddd2",
  tickerUp: "#1c7c4c",
  tickerDown: "#b3261e",
  fontStack:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;
