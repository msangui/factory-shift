import Link from "next/link";
import { BRAND } from "@/config/brand";
import { listIssues } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let issues: Awaited<ReturnType<typeof listIssues>> = [];
  let error: string | null = null;
  try {
    issues = await listIssues(30);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>{BRAND.name}</h1>
      <p style={{ color: "#5b6270", marginTop: 0 }}>{BRAND.tagline}</p>

      {error ? (
        <p style={{ color: "#b3261e" }}>
          The archive is unavailable (no database configured yet). Set <code>DATABASE_URL</code> and run{" "}
          <code>npm run migrate</code>.
        </p>
      ) : issues.length === 0 ? (
        <p style={{ color: "#5b6270" }}>No issues yet. The first one ships on the next weekday at 6am ET.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {issues.map((it) => (
            <li key={it.issue_date} style={{ padding: "12px 0", borderBottom: "1px solid #e2ddd2" }}>
              <Link href={`/issues/${it.issue_date}`} style={{ color: "#20242c", textDecoration: "none" }}>
                <strong>#{it.issue_number}</strong> · {it.issue_date}
                {it.is_short_form ? " · short-form" : ""}
                <div style={{ color: "#5b6270", fontSize: 14 }}>{it.subject}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
