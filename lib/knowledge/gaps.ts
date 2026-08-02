import "server-only";

import { prisma } from "@/lib/prisma";

export interface KnowledgeGap {
  query: string;
  zeroHitCount: number;
  negativeFeedbackCount: number;
  lastAskedAt: Date;
}

const MAX_GAPS = 50;

/**
 * Aggregate knowledge queries that either returned nothing or were rated down,
 * grouped by query text. Surfaces what the team should add to the Notebook.
 */
export async function getKnowledgeGaps(): Promise<KnowledgeGap[]> {
  const [zeroHitGroups, negativeGroups] = await Promise.all([
    prisma.knowledgeQueryLog.groupBy({
      by: ["query"],
      where: { resultCount: 0 },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.knowledgeQueryLog.groupBy({
      by: ["query"],
      where: { feedback: -1 },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  const gaps = new Map<string, KnowledgeGap>();

  for (const group of zeroHitGroups) {
    gaps.set(group.query, {
      query: group.query,
      zeroHitCount: group._count._all,
      negativeFeedbackCount: 0,
      lastAskedAt: group._max.createdAt ?? new Date(0),
    });
  }

  for (const group of negativeGroups) {
    const existing = gaps.get(group.query);
    const lastAsked = group._max.createdAt ?? new Date(0);
    if (existing) {
      existing.negativeFeedbackCount = group._count._all;
      if (lastAsked > existing.lastAskedAt) existing.lastAskedAt = lastAsked;
    } else {
      gaps.set(group.query, {
        query: group.query,
        zeroHitCount: 0,
        negativeFeedbackCount: group._count._all,
        lastAskedAt: lastAsked,
      });
    }
  }

  return [...gaps.values()]
    .sort((a, b) => {
      const scoreB = b.zeroHitCount + b.negativeFeedbackCount;
      const scoreA = a.zeroHitCount + a.negativeFeedbackCount;
      return scoreB - scoreA;
    })
    .slice(0, MAX_GAPS);
}
