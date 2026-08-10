import "server-only";

import { prisma, withTransientRetry } from "@/lib/prisma";

const DEFAULT_MAX_SCANS_PER_HOUR = 20;
const DEFAULT_MAX_QUERIES_PER_MINUTE = 60;

function maxScansPerHour() {
  const value = Number(process.env.KNOWLEDGE_MAX_SCANS_PER_HOUR);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_SCANS_PER_HOUR;
}

function maxQueriesPerMinute() {
  const value = Number(process.env.KNOWLEDGE_MAX_QUERIES_PER_MINUTE);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_QUERIES_PER_MINUTE;
}

/**
 * Rejects when creating `additional` jobs would exceed the hourly scan budget
 * for this user. `additional` lets bulk operations check headroom up front.
 */
export async function assertKnowledgeWriteRateLimit(
  userId: string,
  additional = 1,
) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await withTransientRetry(() =>
    prisma.knowledgeIngestionJob.count({
      where: {
        createdAt: { gte: since },
        source: { createdById: userId },
      },
    }),
  );
  const limit = maxScansPerHour();
  if (count + additional > limit) {
    const remaining = Math.max(limit - count, 0);
    throw new Error(
      remaining > 0
        ? `Knowledge scan limit reached — ${remaining} more scan${remaining === 1 ? "" : "s"} allowed this hour.`
        : "Knowledge scan limit reached. Try again later.",
    );
  }
}

export async function assertKnowledgeQueryRateLimit(userId: string) {
  const since = new Date(Date.now() - 60 * 1000);
  const count = await withTransientRetry(() =>
    prisma.knowledgeQueryLog.count({
      where: { userId, createdAt: { gte: since } },
    }),
  );
  if (count >= maxQueriesPerMinute()) {
    throw new Error("Knowledge search limit reached. Try again in a minute.");
  }
}
