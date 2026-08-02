import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";
import { getKnowledgeGaps } from "@/lib/knowledge/gaps";

export default async function KnowledgeGapsPage() {
  if (!isKnowledgeManagementEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") notFound();

  const gaps = await getKnowledgeGaps();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Knowledge gaps
          </h1>
          <p className="text-sm text-muted-foreground">
            Questions the Notebook could not answer or that were rated down. Add
            sources to close them.
          </p>
        </div>
        <Link
          href="/knowledge"
          className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to knowledge
        </Link>
      </div>

      {gaps.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No gaps recorded yet. Zero-result queries and negative feedback will
          appear here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Query</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  No hits
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Rated down
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Last asked
                </th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((gap) => (
                <tr key={gap.query} className="border-b last:border-0">
                  <td className="px-4 py-2.5 text-foreground">{gap.query}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {gap.zeroHitCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {gap.negativeFeedbackCount}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {new Date(gap.lastAskedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
