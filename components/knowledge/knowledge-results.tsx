interface KnowledgeResult {
  chunkId: string;
  title: string;
  content: string;
  section: string | null;
  pageNumber: number | null;
  sourceUrl: string | null;
  citation: string;
}

export function KnowledgeResults({
  result,
}: {
  result?: { found?: boolean; results?: KnowledgeResult[]; sources?: any[] };
}) {
  const searchResults = result?.results ?? [];
  const readSources = result?.sources ?? [];

  if (!result) {
    return <div className="h-24 rounded-lg bg-muted animate-pulse" />;
  }

  if (result.found === false) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-sm text-amber-800 dark:text-amber-200">
        No approved company knowledge matched this question.
      </div>
    );
  }

  const items = searchResults.length
    ? searchResults
    : readSources.flatMap((source) =>
        (source.passages ?? []).map((passage: any) => ({
          ...passage,
          title: source.title,
          citation: source.citation,
          sourceUrl: source.sourceUrl,
        })),
      );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-card p-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        <SearchCheck size={14} /> Memory consulted
      </div>
      {items.slice(0, 6).map((item: any) => (
        <details key={item.chunkId ?? item.id} className="rounded-md border bg-background p-2.5 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium"><BookOpen size={14} className="shrink-0 text-primary" />{item.citation}</summary>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {item.content.length > 700 ? `${item.content.slice(0, 700)}…` : item.content}
          </p>
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open source <ExternalLink size={11} />
            </a>
          ) : null}
        </details>
      ))}
    </div>
  );
}
import { BookOpen, ExternalLink, SearchCheck } from "lucide-react";
