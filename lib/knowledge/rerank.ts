import "server-only";

import { generateText, type LanguageModel } from "ai";

const MAX_RERANK_CANDIDATES = 12;
const SNIPPET_CHARS = 400;

/**
 * Parse "chunkId: score" lines from the re-rank model's response. Malformed
 * lines are ignored; scores are clamped to the 0..10 range.
 */
export function parseRerankResponse(text: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const match = line.match(
      /^\s*([0-9a-f-]{3,})\s*:\s*(-?\d+(?:\.\d+)?)\s*$/i,
    );
    if (!match) continue;
    scores[match[1]] = Math.max(0, Math.min(10, Number(match[2])));
  }
  return scores;
}

/**
 * Reorder candidate rows by model-assigned relevance. Rows the model did not
 * score keep their relative RRF order and sort after scored rows.
 */
export function applyRerankScores<T extends { chunkId: string; score: number }>(
  rows: T[],
  scores: Record<string, number>,
): T[] {
  if (Object.keys(scores).length === 0) return rows;
  return [...rows].sort((a, b) => {
    const sa = scores[a.chunkId];
    const sb = scores[b.chunkId];
    if (sa === undefined && sb === undefined) return b.score - a.score;
    if (sa === undefined) return 1;
    if (sb === undefined) return -1;
    return sb - sa;
  });
}

/**
 * One bounded LLM call that re-ranks the top RRF candidates by relevance to the
 * query. Falls back to the incoming RRF order on any error so retrieval never
 * hard-fails because of re-ranking.
 */
export async function rerankWithModel<
  T extends { chunkId: string; content: string; score: number },
>(input: {
  query: string;
  candidates: T[];
  model: LanguageModel;
  limit: number;
}): Promise<T[]> {
  const { query, candidates, model, limit } = input;
  const pool = candidates.slice(0, MAX_RERANK_CANDIDATES);
  if (pool.length <= 1) return pool.slice(0, limit);

  try {
    const listing = pool
      .map(
        (candidate) =>
          `${candidate.chunkId}: ${candidate.content.slice(0, SNIPPET_CHARS).replace(/\s+/g, " ")}`,
      )
      .join("\n");

    const { text } = await generateText({
      model,
      prompt: `You are a relevance grader for a company knowledge search.
Question: ${query}

For each candidate passage below, output one line "id: score" where score is an integer 0-10 for how well it answers the question (10 = directly answers, 0 = irrelevant). Output ONLY those lines, no prose.

Candidates:
${listing}`,
    });

    const scores = parseRerankResponse(text);
    return applyRerankScores(pool, scores).slice(0, limit);
  } catch (error) {
    console.error("Knowledge re-rank failed; using RRF order", error);
    return pool.slice(0, limit);
  }
}
