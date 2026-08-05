/** Small pure helpers shared across ingestion, drafting, and the critics. */

/** Word count using a simple whitespace/punctuation split. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Average sentence length in words (used by the Voice rubric). */
export function avgSentenceLength(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return 0;
  const total = sentences.reduce((n, s) => n + countWords(s), 0);
  return total / sentences.length;
}

/** True if the string contains at least one digit (Deal Flow bullets must). */
export function containsNumber(text: string): boolean {
  return /\d/.test(text);
}

/**
 * Normalize a URL for equality checks: lowercase host, strip trailing slash,
 * drop common tracking query params and the fragment. Best-effort; returns the
 * input unchanged if it can't be parsed.
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const k of drop) u.searchParams.delete(k);
    u.host = u.host.toLowerCase();
    let s = u.toString();
    s = s.replace(/\/$/, "");
    return s;
  } catch {
    return raw.trim();
  }
}

/** Loose title normalization for duplicate detection across issues. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hours between two dates (b - a), positive if b is later. */
export function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}

/** Today's date as YYYY-MM-DD in a given IANA timezone. */
export function isoDateInTz(date: Date, timeZone: string): string {
  // en-CA yields YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Hour (0–23) in a given IANA timezone. */
export function hourInTz(date: Date, timeZone: string): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return Number.parseInt(s, 10) % 24;
}

/** Deterministic pick from a list, seeded by a string (e.g. the issue date). */
export function seededPick<T>(items: readonly T[], seed: string): T {
  if (items.length === 0) throw new Error("seededPick: empty list");
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % items.length;
  return items[idx] as T;
}

/** Strip HTML tags and collapse whitespace (for RSS summary snippets). */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate to a max length on a word boundary, adding an ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trim()}…`;
}
