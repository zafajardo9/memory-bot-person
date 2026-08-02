import "server-only";


import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { embedKnowledgeQuery } from "./embeddings";
import { assembleHybridResults } from "./ranking";
import { assertKnowledgeQueryRateLimit } from "./rate-limit";
import { rerankWithModel } from "./rerank";

import type {
  KnowledgeSearchOutcome,
  KnowledgeSearchResult,
} from "./types";
import type { LanguageModel } from "ai";

interface SearchRow {
  chunkId: string;
  sourceId: string;
  versionId: string;
  title: string;
  content: string;
  section: string | null;
  pageNumber: number | null;
  sourceUrl: string | null;
}

const CANDIDATE_POOL = 20;

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
  agentId: string;
  limit?: number;
  rerankModel?: LanguageModel;
}): Promise<KnowledgeSearchOutcome> {
  const startedAt = Date.now();
  await assertKnowledgeQueryRateLimit(input.userId);
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 10);
  const embedding = await embedKnowledgeQuery(input.query);
  const vector = `[${embedding.join(",")}]`;

  const baseSelect = Prisma.sql`
      chunk."id"::text AS "chunkId",
      source."id"::text AS "sourceId",
      version."id"::text AS "versionId",
      source."title" AS "title",
      chunk."content" AS "content",
      chunk."section" AS "section",
      chunk."pageNumber" AS "pageNumber",
      COALESCE(chunk."sourceUrl", source."canonicalUrl") AS "sourceUrl"
  `;
  const baseFrom = Prisma.sql`
    FROM "KnowledgeChunk" chunk
    JOIN "KnowledgeSourceVersion" version ON version."id" = chunk."versionId"
    JOIN "KnowledgeSource" source ON source."id" = version."sourceId"
    JOIN "AgentKnowledgeSource" assignment
      ON assignment."sourceId" = source."id"
      AND assignment."agentId" = ${input.agentId}::uuid
    WHERE source."status" = 'APPROVED'::"KnowledgeSourceStatus"
      AND version."status" = 'APPROVED'::"KnowledgeVersionStatus"
      AND source."currentVersionId" = version."id"
      AND chunk."embedding" IS NOT NULL
  `;

  const [vectorRows, ftsRows] = await Promise.all([
    prisma.$queryRaw<SearchRow[]>`
      SELECT ${baseSelect}
      ${baseFrom}
      ORDER BY chunk."embedding" <=> ${vector}::vector
      LIMIT ${CANDIDATE_POOL}
    `,
    prisma.$queryRaw<SearchRow[]>`
      SELECT ${baseSelect}
      ${baseFrom}
        AND chunk."searchVector" @@ websearch_to_tsquery('english', ${input.query})
      ORDER BY ts_rank_cd(chunk."searchVector", websearch_to_tsquery('english', ${input.query})) DESC
      LIMIT ${CANDIDATE_POOL}
    `,
  ]);

  const fused = assembleHybridResults(vectorRows, ftsRows, CANDIDATE_POOL);

  const ranked: (SearchRow & { score: number })[] = input.rerankModel
    ? await rerankWithModel({
        query: input.query,
        candidates: fused,
        model: input.rerankModel,
        limit,
      })
    : fused.slice(0, limit);

  const results = ranked.map((row) => ({
    chunkId: row.chunkId,
    sourceId: row.sourceId,
    versionId: row.versionId,
    title: row.title,
    content: row.content,
    section: row.section,
    pageNumber: row.pageNumber,
    sourceUrl: row.sourceUrl,
    score: row.score,
    citation: citationFor(row),
  }));

  const log = await prisma.knowledgeQueryLog.create({
    data: {
      userId: input.userId,
      chatId: input.chatId,
      agentId: input.agentId,
      query: input.query,
      retrievedChunkIds: results.map((result) => result.chunkId),
      resultCount: results.length,
      latencyMs: Date.now() - startedAt,
    },
  });

  return { results, queryLogId: log.id };
}

export async function readCompanyKnowledge(chunkIds: string[], agentId: string) {
  const selected = await prisma.knowledgeChunk.findMany({
    where: {
      id: { in: chunkIds.slice(0, 10) },
      version: {
        status: "APPROVED",
        source: {
          status: "APPROVED",
          agents: { some: { agentId } },
        },
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
