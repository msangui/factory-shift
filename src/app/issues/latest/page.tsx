import { notFound } from "next/navigation";
import { getLatestIssue } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LatestIssuePage() {
  let html: string | null = null;
  let date = "latest";
  try {
    const issue = await getLatestIssue();
    html = issue?.html ?? null;
    date = issue?.issue_date ?? "latest";
  } catch {
    html = null;
  }
  if (!html) notFound();

  return (
    <iframe
      title={`The Morning Shelf — ${date}`}
      srcDoc={html}
      style={{ width: "100%", minHeight: "100vh", border: "none" }}
    />
  );
}
