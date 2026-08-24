/**
 * Brand identity for the newsletter.
 *
 * Naming note (per spec: "propose 3 alternatives before first deploy"):
 * candidates floated for this vertical were "Shift Change", "The Line", and
 * "Torque & Ledger". The operator chose **The Factory Shift**, which also
 * matches the repository name. All other candidates are recorded here for
 * provenance; change `name` to rebrand everywhere.
 */
export const BRAND = {
  name: "The Factory Shift",
  tagline: "Automotive & manufacturing business news, before the morning shift.",
  /** Candidates considered before launch — kept for the record. */
  nameCandidates: ["Shift Change", "The Line", "Torque & Ledger"],
  /** Sign-off personality lines; the pipeline picks one deterministically per issue. */
  signOffs: [
    "That's your shift — clocking back in tomorrow at 6am.",
    "Tools down. See you on the next shift.",
    "Now go forth and read a 10-K for fun.",
    "Same line, same time tomorrow.",
    "Clock out — we'll restart the line tomorrow morning.",
  ],
} as const;

export type Brand = typeof BRAND;
