/**
 * Brand identity for the newsletter.
 *
 * Naming note (per spec: "propose 3 alternatives before first deploy"):
 * three candidates were floated — "Aisle & Ledger" (spec working name),
 * "Checkout", and "Shelf Life". The operator chose **The Morning Shelf**,
 * which also matches the repository name. All other candidates are recorded
 * here for provenance; change `name` to rebrand everywhere.
 */
export const BRAND = {
  name: "The Morning Shelf",
  tagline: "Retail & CPG business news, before your first coffee.",
  /** Candidates considered before launch — kept for the record. */
  nameCandidates: ["Aisle & Ledger", "Checkout", "Shelf Life"],
  /** Sign-off personality lines; the pipeline picks one deterministically per issue. */
  signOffs: [
    "That's the shelf for today — restocking tomorrow at 6am.",
    "Prices up, patience down. See you tomorrow.",
    "Now go forth and read a 10-K for fun.",
    "Same aisle, same time tomorrow.",
    "Ring us up again tomorrow morning.",
  ],
} as const;

export type Brand = typeof BRAND;
