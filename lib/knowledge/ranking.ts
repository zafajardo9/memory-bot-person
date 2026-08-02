export const RRF_K = 60;

/**
 * Scale-free Reciprocal Rank Fusion. Each input array is an ordered list of
 * chunk ids (best first) from one ranking signal. Returns id -> fused score.
 *
 * RRF avoids the scale mismatch between cosine-similarity and ts_rank_cd by
 * ranking each signal independently and summing 1 / (k + rank) contributions.
 */
export function reciprocalRankFusion(
  rankedLists: string[][],
  k: number = RRF_K,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return scores;
}

/**
 * Fuse two ordered candidate pools (vector-ranked and FTS-ranked) into a single
 * RRF-ordered result list capped at `limit`. Rows carry their fused score.
 */
export function assembleHybridResults<T extends { chunkId: string }>(
  vectorRows: T[],
  ftsRows: T[],
  limit: number,
  k: number = RRF_K,
): (T & { score: number })[] {
  const byId = new Map<string, T>();
  for (const row of [...vectorRows, ...ftsRows]) {
    if (!byId.has(row.chunkId)) byId.set(row.chunkId, row);
  }

  const fused = reciprocalRankFusion(
    [vectorRows.map((row) => row.chunkId), ftsRows.map((row) => row.chunkId)],
    k,
  );

  return [...fused.entries()]
    .map(([id, score]) => ({ ...(byId.get(id) as T), score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
