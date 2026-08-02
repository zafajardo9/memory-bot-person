"use client";

import { BookOpenCheck, ChevronDown, ExternalLink } from "lucide-react";

interface KnowledgeResult {
  chunkId: string;
  title: string;
  content: string;
  section?: string | null;
  pageNumber?: number | null;
  sourceUrl?: string | null;
  score?: number | null;
  citation?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function coerceResults(output: unknown): KnowledgeResult[] {
  if (!isRecord(output) || !Array.isArray(output.results)) return [];
  return output.results.filter(isRecord).map((result) => ({
    chunkId: typeof result.chunkId === "string" ? result.chunkId : "",
    title: typeof result.title === "string" ? result.title : "Untitled source",
    content: typeof result.content === "string" ? result.content : "",
    section: typeof result.section === "string" ? result.section : null,
    pageNumber: typeof result.pageNumber === "number" ? result.pageNumber : null,
    sourceUrl: typeof result.sourceUrl === "string" ? result.sourceUrl : null,
    score: typeof result.score === "number" ? result.score : null,
    citation: typeof result.citation === "string" ? result.citation : undefined,
  }));
}

/** Relative relevance badge. RRF scores are small; map to a 0-100 feel. */
function relevanceLabel(score: number | null | undefined) {
  if (score == null) return null;
  const pct = Math.max(0, Math.min(100, Math.round(score * 1000)));
  return `${pct}% match`;
}

/**
 * Expandable evidence cards for Notebook (internal) knowledge search hits.
 * Renders inline under the "Searched company knowledge" activity step so the
 * user can see exactly which passages grounded the answer.
 */
export function KnowledgeSourceCards({ output }: { output: unknown }) {
  const results = coerceResults(output);
  if (results.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {results.map((result, index) => {
        const relevance = relevanceLabel(result.score);
        const location = [
          result.section,
          result.pageNumber != null ? `p. ${result.pageNumber}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <details
            key={result.chunkId || index}
            className="group/kb rounded-md border border-border bg-muted/30 text-xs"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <BookOpenCheck
                size={12}
                className="shrink-0 text-emerald-700 dark:text-emerald-300"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">
                  {result.title}
                </span>
                {location ? (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {location}
                  </span>
                ) : null}
              </span>
              {relevance ? (
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                  {relevance}
                </span>
              ) : null}
              <ChevronDown
                size={12}
                className="shrink-0 text-muted-foreground transition-transform group-open/kb:rotate-180"
              />
            </summary>
            <div className="border-t border-border px-2.5 py-2">
              <p className="whitespace-pre-wrap leading-5 text-muted-foreground">
                {result.content}
              </p>
              {result.sourceUrl ? (
                <a
                  href={result.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 font-medium text-sky-700 underline decoration-border underline-offset-4 transition-colors hover:text-sky-600 dark:text-sky-300"
                >
                  Open source
                  <ExternalLink size={11} />
                </a>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
