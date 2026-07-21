import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { KnowledgeSourceActions } from "@/components/knowledge/knowledge-source-actions";
import { getKnowledgeSource } from "@/db/knowledge-queries";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";

export default async function KnowledgeSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isKnowledgeManagementEnabled()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const source = await getKnowledgeSource(id);
  if (!source) notFound();

  const canEdit = session.user.role === "ADMIN" || source.createdById === session.user.id;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 pb-16 pt-24 sm:px-6">
      <header className="border-b pb-6">
        <Link href="/knowledge" className="text-sm font-medium text-primary hover:underline">
          ← Back to notebook
        </Link>
        <p className="eyebrow mt-5">Knowledge source</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">{source.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {source.type} · {source.status} · {source.versions.length} version(s)
        </p>
      </header>

      {canEdit ? <KnowledgeSourceActions sourceId={source.id} sourceType={source.type} initialContent={source.versions[0]?.extractedText ?? ""} /> : null}

      {source.versions.map((version) => (
        <section key={version.id} className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Version {version.version}</h2>
            <span className="rounded-md border bg-muted px-2 py-0.5 font-mono text-[10px]">{version.status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {version._count.chunks} chunks · {version.embeddingModel ?? "not embedded"}
          </p>
          {version.errorMessage ? <p className="mt-3 text-sm text-red-600">{version.errorMessage}</p> : null}
          {version.extractedText ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">Preview extracted text</summary>
              <pre className="mt-3 max-h-[500px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs">
                {version.extractedText.slice(0, 20_000)}
                {version.extractedText.length > 20_000 ? "\n\n… preview truncated" : ""}
              </pre>
            </details>
          ) : null}
        </section>
      ))}
    </main>
  );
}
