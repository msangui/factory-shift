import { listHolds } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Held-issue report. Guarded by the CRON_SECRET as a `?key=` query param so a
 * held issue can be reviewed before any manual send. If no CRON_SECRET is set
 * (dev), the page is open.
 */
export default async function HoldsPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  const secret = process.env.CRON_SECRET;
  if (secret && key !== secret) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
        <h1>Held issues</h1>
        <p style={{ color: "#b3261e" }}>Unauthorized. Append <code>?key=YOUR_CRON_SECRET</code>.</p>
      </main>
    );
  }

  let holds: Awaited<ReturnType<typeof listHolds>> = [];
  let error: string | null = null;
  try {
    holds = await listHolds();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px" }}>
      <h1>Held issues</h1>
      <p style={{ color: "#5b6270" }}>
        Issues that failed the Gauntlet after {" "}
        <strong>3</strong> iterations. Review, fix upstream, and ship manually.
      </p>
      {error ? (
        <p style={{ color: "#b3261e" }}>Database unavailable: {error}</p>
      ) : holds.length === 0 ? (
        <p style={{ color: "#5b6270" }}>No holds. Everything shipped clean. ☕</p>
      ) : (
        holds.map((h) => (
          <section key={h.issue_date} style={{ margin: "20px 0", padding: 16, border: "1px solid #e2ddd2", borderRadius: 8, background: "#fff" }}>
            <h2 style={{ margin: "0 0 6px 0" }}>{h.issue_date}</h2>
            <div style={{ color: "#b3261e", fontWeight: 600 }}>Failing critics: {h.failing_critics.join(", ")}</div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer" }}>Unresolved violations</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "#f6f4ef", padding: 12, borderRadius: 6 }}>
                {JSON.stringify(h.unresolved_violations, null, 2)}
              </pre>
            </details>
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: "pointer" }}>Drafts ({h.drafts.length})</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#f6f4ef", padding: 12, borderRadius: 6 }}>
                {JSON.stringify(h.drafts, null, 2)}
              </pre>
            </details>
            <p style={{ marginTop: 10 }}>
              <a
                href={h.html ? `/api/holds/${h.issue_date}/html${key ? `?key=${encodeURIComponent(key)}` : ""}` : `/api/issues/${h.issue_date}/html`}
                style={{ color: "#b3541e" }}
              >
                Preview the held draft →
              </a>
            </p>
            <form
              method="post"
              action={`/api/issues/${h.issue_date}/ship${key ? `?key=${encodeURIComponent(key)}` : ""}`}
              style={{ marginTop: 6 }}
            >
              <button
                type="submit"
                style={{ background: "#1c7c4c", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}
              >
                Ship this issue →
              </button>
            </form>
          </section>
        ))
      )}
    </main>
  );
}
