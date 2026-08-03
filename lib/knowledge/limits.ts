import "server-only";

import { prisma, withTransientRetry } from "@/lib/prisma";

const DEFAULT_MAX_SOURCES = 250;
const DEFAULT_MAX_CONTEXT_TOKENS = 1_000_000;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getKnowledgeLimits() {
  return {
    maxSources: positiveInteger(
      process.env.KNOWLEDGE_MAX_SOURCES,
      DEFAULT_MAX_SOURCES,
    ),
    maxContextTokens: positiveInteger(
      process.env.KNOWLEDGE_MAX_CONTEXT_TOKENS,
      DEFAULT_MAX_CONTEXT_TOKENS,
    ),
  };
}

export async function getKnowledgeUsage() {
  const limits = getKnowledgeLimits();
  const [sourceCount, chunks] = await Promise.all([
    withTransientRetry(() =>
      prisma.knowledgeSource.count({
        where: { status: { not: "ARCHIVED" } },
      }),
    ),
    withTransientRetry(() =>
      prisma.knowledgeChunk.aggregate({
        where: {
          version: {
            status: { in: ["READY", "APPROVED"] },
            source: { status: { not: "ARCHIVED" } },
          },
        },
        _count: { id: true },
        _sum: { tokenCount: true },
      }),
    ),
  ]);

  const contextTokens = chunks._sum.tokenCount ?? 0;

  return {
    sources: { used: sourceCount, limit: limits.maxSources },
    contextTokens: {
      used: contextTokens,
      limit: limits.maxContextTokens,
    },
    passages: chunks._count.id,
  };
}

export async function assertKnowledgeSourceCapacity() {
  const { maxSources } = getKnowledgeLimits();
  const sourceCount = await withTransientRetry(() =>
    prisma.knowledgeSource.count({
      where: { status: { not: "ARCHIVED" } },
    }),
  );

  if (sourceCount >= maxSources) {
    throw new Error(
      `The workspace knowledge limit of ${maxSources.toLocaleString()} sources has been reached. Archive or delete a source before adding another.`,
    );
  }
}

export async function assertKnowledgeTokenCapacity(
  incomingTokens: number,
  excludedVersionId?: string,
) {
  const { maxContextTokens } = getKnowledgeLimits();
  const existing = await prisma.knowledgeChunk.aggregate({
    where: {
      version: {
        status: { in: ["READY", "APPROVED"] },
        source: { status: { not: "ARCHIVED" } },
        ...(excludedVersionId ? { id: { not: excludedVersionId } } : {}),
      },
    },
    _sum: { tokenCount: true },
  });
  const usedTokens = existing._sum.tokenCount ?? 0;

  if (usedTokens + incomingTokens > maxContextTokens) {
    const remaining = Math.max(0, maxContextTokens - usedTokens);
    throw new Error(
      `This source needs about ${incomingTokens.toLocaleString()} context tokens, but only ${remaining.toLocaleString()} remain. Remove or archive knowledge before trying again.`,
    );
  }
}
