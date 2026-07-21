import "server-only";

import { prisma } from "@/lib/prisma";

import { embedKnowledgeQuery } from "./embeddings";
import { assertKnowledgeQueryRateLimit } from "./rate-limit";

import type { KnowledgeSearchResult } from "./types";

interface SearchRow {
  chunkId: string;
  sourceId: string;
  versionId: string;
  title: string;
  content: string;
  section: string | null;
  pageNumber: number | null;
  sourceUrl: string | null;
  score: number;
}

function citationFor(result: Omit<SearchRow, "score">) {
  const location = result.pageNumber
    ? `page ${result.pageNumber}`
    : result.section
      ? result.section
      : "source";
  return `${result.title} — ${location}`;
}

export async function searchCompanyKnowledge(input: {
  query: string;
  userId: string;
  chatId?: string;
  limit?: number;
}): Promise<KnowledgeSearchResult[]> {
  const startedAt = Date.now();
  await assertKnowledgeQueryRateLimit(input.userId);
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 10);
  const embedding = await embedKnowledgeQuery(input.query);
  const vector = `[${embedding.join(",")}]`;

  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT
      chunk."id"::text AS "chunkId",
      source."id"::text AS "sourceId",
      version."id"::text AS "versionId",
      source."title" AS "title",
      chunk."content" AS "content",
      chunk."section" AS "section",
      chunk."pageNumber" AS "pageNumber",
      COALESCE(chunk."sourceUrl", source."canonicalUrl") AS "sourceUrl",
      (
        0.65 * (1 - (chunk."embedding" <=> ${vector}::vector)) +
        0.35 * ts_rank_cd(chunk."searchVector", websearch_to_tsquery('english', ${input.query}))
      )::float8 AS "score"
    FROM "KnowledgeChunk" chunk
    JOIN "KnowledgeSourceVersion" version ON version."id" = chunk."versionId"
    JOIN "KnowledgeSource" source ON source."id" = version."sourceId"
    WHERE source."status" = 'APPROVED'::"KnowledgeSourceStatus"
      AND version."status" = 'APPROVED'::"KnowledgeVersionStatus"
      AND source."currentVersionId" = version."id"
      AND chunk."embedding" IS NOT NULL
    ORDER BY "score" DESC
    LIMIT ${limit}
  `;

  const results = rows
    .filter((row) => row.score >= 0.15)
    .map((row) => ({ ...row, citation: citationFor(row) }));

  await prisma.knowledgeQueryLog.create({
    data: {
      userId: input.userId,
      chatId: input.chatId,
      query: input.query,
      retrievedChunkIds: results.map((result) => result.chunkId),
      resultCount: results.length,
      latencyMs: Date.now() - startedAt,
    },
  });

  return results;
}

export async function readCompanyKnowledge(chunkIds: string[]) {
  const selected = await prisma.knowledgeChunk.findMany({
    where: {
      id: { in: chunkIds.slice(0, 10) },
      version: {
        status: "APPROVED",
        source: { status: "APPROVED" },
      },
    },
    include: {
      version: { include: { source: true } },
    },
  });

  const contexts = await Promise.all(
    selected.map(async (chunk) => {
      const neighbors = await prisma.knowledgeChunk.findMany({
        where: {
          versionId: chunk.versionId,
          ordinal: { gte: Math.max(0, chunk.ordinal - 1), lte: chunk.ordinal + 1 },
        },
        orderBy: { ordinal: "asc" },
        select: { id: true, content: true, section: true, pageNumber: true, sourceUrl: true },
      });
      return {
        sourceId: chunk.version.source.id,
        versionId: chunk.versionId,
        title: chunk.version.source.title,
        citation: citationFor({
          chunkId: chunk.id,
          sourceId: chunk.version.source.id,
          versionId: chunk.versionId,
          title: chunk.version.source.title,
          content: chunk.content,
          section: chunk.section,
          pageNumber: chunk.pageNumber,
          sourceUrl: chunk.sourceUrl ?? chunk.version.source.canonicalUrl,
        }),
        sourceUrl: chunk.sourceUrl ?? chunk.version.source.canonicalUrl,
        passages: neighbors,
      };
    }),
  );

  return contexts;
}
