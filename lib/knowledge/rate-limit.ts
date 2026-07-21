import "server-only";

import { prisma } from "@/lib/prisma";

export async function assertKnowledgeWriteRateLimit(userId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.knowledgeIngestionJob.count({
    where: {
      createdAt: { gte: since },
      source: { createdById: userId },
    },
  });
  if (count >= 20) {
    throw new Error("Knowledge scan limit reached. Try again later.");
  }
}

export async function assertKnowledgeQueryRateLimit(userId: string) {
  const since = new Date(Date.now() - 60 * 1000);
  const count = await prisma.knowledgeQueryLog.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (count >= 30) {
    throw new Error("Knowledge search limit reached. Try again in a minute.");
  }
}
