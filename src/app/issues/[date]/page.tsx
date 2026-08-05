import { notFound } from "next/navigation";
import { getIssue } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function IssuePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  let html: string | null = null;
  try {
    const issue = await getIssue(date);
    html = issue?.html ?? null;
  } catch {
    html = null;
  }
  if (!html) notFound();

  // Render the self-contained email document in an isolated iframe so the web
  // version matches the inbox exactly.
  return (
    <iframe
      title={`The Morning Shelf — ${date}`}
      srcDoc={html}
      style={{ width: "100%", minHeight: "100vh", border: "none" }}
    />
  );
}
