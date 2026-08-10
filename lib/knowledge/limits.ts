import "server-only";

import { prisma, withTransientRetry } from "@/lib/prisma";

// Knowledge is unlimited by default. Set KNOWLEDGE_MAX_SOURCES /
// KNOWLEDGE_MAX_CONTEXT_TOKENS to a positive integer to impose an explicit cap,
// or "0"/"unlimited"/"none" to keep (or restore) the unlimited behavior.
function parseLimit(
  value: string | undefined,
): number | null {
  if (value === undefined || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "0" || normalized === "unlimited" || normalized === "none") {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getKnowledgeLimits() {
  return {
    maxSources: parseLimit(process.env.KNOWLEDGE_MAX_SOURCES),
    maxContextTokens: parseLimit(process.env.KNOWLEDGE_MAX_CONTEXT_TOKENS),
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

  const indexedTokens = chunks._sum.tokenCount ?? 0;

  return {
    sources: { used: sourceCount, limit: limits.maxSources },
    contextTokens: {
      // Retain the API field name for compatibility. These are tokens stored
      // in the index, not tokens loaded into a model prompt.
      used: indexedTokens,
      limit: limits.maxContextTokens,
    },
    passages: chunks._count.id,
  };
}

export async function assertKnowledgeSourceCapacity() {
  const { maxSources } = getKnowledgeLimits();
  if (maxSources === null) return; // unlimited

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
  if (maxContextTokens === null) return; // unlimited

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
      `This source needs about ${incomingTokens.toLocaleString()} indexed tokens, but only ${remaining.toLocaleString()} remain. Remove or archive knowledge before trying again.`,
    );
  }
}
