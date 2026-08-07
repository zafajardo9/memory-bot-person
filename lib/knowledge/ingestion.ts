import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { asJson } from "@/db/knowledge-queries";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma, withTransientRetry } from "@/lib/prisma";
import { downloadKnowledgeFile } from "@/lib/storage/imagekit";
import { readRenderedWebPage } from "@/lib/web/agent-browser";
import { isAgentBrowserEnabled } from "@/lib/web/config";

import { chunkSections } from "./chunking";
import { isKnowledgeIndexingEnabled } from "./config";
import { resolveKnowledgeEmbeddingEngines } from "./embedding-settings";
import {
  embedKnowledgeDocument,
  pickKnowledgeEmbeddingEngine,
} from "./embeddings";
import { extractDocx } from "./extractors/docx";
import { extractPdf } from "./extractors/pdf";
import { extractStructuredText } from "./extractors/text";
import { extractWebPage } from "./extractors/web-page";
import { assertKnowledgeTokenCapacity } from "./limits";
import { fetchPublicKnowledgeUrl } from "./url-security";
import { MAX_EXTRACTED_TEXT_SIZE } from "./validation";

import type { ExtractedDocument, ExtractedSection } from "./types";

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

const EMBEDDING_CONCURRENCY = 6;
const VECTOR_UPDATE_BATCH = 100;
const KNOWLEDGE_BROWSER_CONTENT_LIMIT = 100_000;

/**
 * Runs `worker` over `items` with at most `concurrency` promises in flight.
 * Results are returned in input order. Embedding calls are independent network
 * round-trips — serializing them (the old behavior) multiplied latency by N.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function pump() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => pump(),
  );
  await Promise.all(workers);
  return results;
}

async function extractBytes(bytes: Uint8Array, mimeType: string, sourceUrl?: string) {
  if (mimeType === "application/pdf") return extractPdf(bytes, sourceUrl);
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractDocx(bytes, sourceUrl);
  }
  return extractStructuredText(new TextDecoder().decode(bytes), sourceUrl);
}

async function resolveFileBytes(version: {
  originalContent: Uint8Array<ArrayBuffer> | null;
  storageProvider: string | null;
  storageRef: string | null;
}): Promise<Uint8Array> {
  if (version.storageProvider === "imagekit" && version.storageRef) {
    try {
      return await downloadKnowledgeFile(version.storageRef);
    } catch (error) {
      console.error("ImageKit download failed, falling back to stored content:", error);
    }
  }
  return new Uint8Array(version.originalContent ?? []);
}

async function extractUrlSource(url: string, crawlDepth: number, crawlLimit: number) {
  const origin = new URL(url).origin;
  const queue: Array<{ url: string; depth: number }> = [{ url, depth: 0 }];
  const visited = new Set<string>();
  const sections: ExtractedSection[] = [];
  const pages: Array<{ url: string; title?: string }> = [];

  while (queue.length && visited.size < crawlLimit) {
    const next = queue.shift()!;
    if (visited.has(next.url)) continue;
    visited.add(next.url);

    let document: ExtractedDocument;
    let finalUrl = next.url;
    try {
      ({ document, finalUrl } = await fetchStaticUrlDocument(next.url));
    } catch (error) {
      if (!isAgentBrowserEnabled()) {
        // A failed secondary page must not discard useful content already
        // extracted from the root page and its other links.
        if (next.depth > 0 || sections.length > 0) {
          console.warn(
            "Skipping unreadable linked knowledge page:",
            next.url,
            error instanceof Error ? error.message : error,
          );
          continue;
        }
        throw error;
      }
      console.warn(
        "Static URL fetch failed for knowledge source, falling back to Agent Browser:",
        error instanceof Error ? error.message : error,
      );
      try {
        ({ document, finalUrl } = await renderUrlDocument(next.url));
      } catch (browserError) {
        if (next.depth > 0 || sections.length > 0) {
          console.warn(
            "Skipping linked page after rendered fallback failed:",
            next.url,
            browserError instanceof Error ? browserError.message : browserError,
          );
          continue;
        }
        throw browserError;
      }
    }

    // Some pages return a valid HTML shell that renders zero text (client-side
    // JS). Retry with the headless browser when static extraction came up empty.
    if (document.sections.length === 0 && isAgentBrowserEnabled()) {
      try {
        ({ document, finalUrl } = await renderUrlDocument(next.url));
      } catch (browserError) {
        console.warn(
          "Rendered knowledge fallback failed; keeping the static crawl:",
          next.url,
          browserError instanceof Error ? browserError.message : browserError,
        );
      }
    }

    if (document.sections.length === 0) {
      continue;
    }

    sections.push(...document.sections);
    pages.push({ url: finalUrl, title: document.title });

    if (next.depth < crawlDepth) {
      for (const link of document.discoveredLinks ?? []) {
        if (new URL(link).origin === origin && !visited.has(link)) {
          queue.push({ url: link, depth: next.depth + 1 });
        }
      }
    }
  }

  return { sections, metadata: { pages } } satisfies ExtractedDocument;
}

/**
 * Fetches a URL with a plain HTTP request and extracts its text. Fails for
 * JS-rendered pages whose HTML shell contains no readable content.
 */
async function fetchStaticUrlDocument(url: string) {
  const fetched = await fetchPublicKnowledgeUrl(url);
  let document: ExtractedDocument;
  if (fetched.contentType === "application/pdf") {
    document = await extractPdf(fetched.bytes, fetched.url);
  } else if (["text/plain", "text/markdown"].includes(fetched.contentType)) {
    document = extractStructuredText(new TextDecoder().decode(fetched.bytes), fetched.url);
  } else if (fetched.contentType === "text/html") {
    document = extractWebPage(new TextDecoder().decode(fetched.bytes), fetched.url);
  } else {
    throw new Error(`Unsupported linked content type: ${fetched.contentType}`);
  }
  return { document, finalUrl: fetched.url };
}

/**
 * Opens the URL in a real headless browser (Agent Browser), waits for
 * JavaScript to render, and returns the visible text. This is the fallback for
 * SPAs and client-side-rendered pages that a plain fetch cannot read.
 */
async function renderUrlDocument(url: string) {
  const rendered = await readRenderedWebPage(url, {
    limit: KNOWLEDGE_BROWSER_CONTENT_LIMIT,
  });
  const sections = rendered.content
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter((block) => block.length > 20)
    .map((block) => ({ content: block, sourceUrl: rendered.url }));
  return {
    document: { sections } satisfies ExtractedDocument,
    finalUrl: rendered.url,
  };
}

export async function processKnowledgeJob(jobId: string) {
  if (!isKnowledgeIndexingEnabled()) return;
  const job = await prisma.knowledgeIngestionJob.findUnique({
    where: { id: jobId },
    include: { source: true, version: true },
  });
  if (!job || job.status === "COMPLETED") return;

  try {
    await prisma.$transaction([
      prisma.knowledgeIngestionJob.update({
        where: { id: jobId },
        data: {
          status: "PROCESSING",
          stage: "extracting",
          progress: 10,
          attempts: { increment: 1 },
          startedAt: new Date(),
          errorMessage: null,
        },
      }),
      prisma.knowledgeSource.update({
        where: { id: job.sourceId },
        data: { status: "PROCESSING" },
      }),
      prisma.knowledgeSourceVersion.update({
        where: { id: job.versionId },
        data: { status: "PROCESSING", errorMessage: null },
      }),
    ]);

    const document =
      job.source.type === "FILE" || job.source.type === "NOTE"
        ? await extractBytes(
            await resolveFileBytes(job.version),
            job.source.mimeType ?? "text/plain",
          )
        : await extractUrlSource(
            job.source.canonicalUrl!,
            job.source.crawlDepth,
            job.source.crawlLimit,
          );

    const extractedText = document.sections.map((section) => section.content).join("\n\n").trim();
    if (!extractedText) throw new Error("No readable text was found in this source");
    if (extractedText.length > MAX_EXTRACTED_TEXT_SIZE) {
      throw new Error("Extracted knowledge exceeds the 2,000,000 character limit");
    }

    const checksum = sha256(extractedText);
    const duplicate = await prisma.knowledgeSourceVersion.findFirst({
      where: { sourceId: job.sourceId, checksum, id: { not: job.versionId } },
    });
    if (duplicate) {
      await prisma.$transaction([
        prisma.knowledgeSourceVersion.update({
          where: { id: job.versionId },
          data: {
            status: "ARCHIVED",
            checksum: `duplicate-${job.versionId}`.slice(0, 64),
            extractedText,
            metadata: asJson({ ...document.metadata, duplicateOf: duplicate.id }),
          },
        }),
        prisma.knowledgeIngestionJob.update({
          where: { id: jobId },
          data: {
            status: "COMPLETED",
            stage: "unchanged",
            progress: 100,
            completedAt: new Date(),
          },
        }),
        prisma.knowledgeSource.update({
          where: { id: job.sourceId },
          data: { status: job.source.currentVersionId ? "APPROVED" : "DRAFT" },
        }),
      ]);
      return;
    }

    const chunks = chunkSections(document.sections);
    if (chunks.length === 0) throw new Error("The source did not produce searchable knowledge chunks");
    const incomingTokens = chunks.reduce(
      (total, chunk) => total + chunk.tokenCount,
      0,
    );
    await assertKnowledgeTokenCapacity(incomingTokens, job.versionId);

    await prisma.knowledgeIngestionJob.update({
      where: { id: jobId },
      data: { stage: "embedding", progress: 35 },
    });
    const embeddingEngines = await resolveKnowledgeEmbeddingEngines();
    // Pick one provider for the whole job so every vector stays in the same
    // space; falls back to other configured providers when the active one is
    // rate-limited or unavailable.
    const selectedEngine = await pickKnowledgeEmbeddingEngine(
      embeddingEngines,
      chunks[0].embeddingText,
      "RETRIEVAL_DOCUMENT",
    );
    // Idempotent re-run: a job re-triggered while PROCESSING (e.g. after a
    // serverless timeout killed the previous invocation) resumes from scratch
    // safely because prior chunks are cleared before embedding again.
    await prisma.knowledgeChunk.deleteMany({ where: { versionId: job.versionId } });

    // Embed every chunk with bounded concurrency — embedding calls are
    // independent network round-trips, so serializing them (the old behavior)
    // multiplied wall time by the chunk count.
    let embedded = 0;
    const embeddings = await mapWithConcurrency(
      chunks,
      EMBEDDING_CONCURRENCY,
      async (chunk, index) => {
        const embedding = selectedEngine
          ? index === 0
            ? selectedEngine.embedding
            : await embedKnowledgeDocument(chunk.embeddingText, job.source.title, [
                selectedEngine.engine,
              ])
          : // Every provider failed — the empty list routes to the dev-only
            // local fallback (or throws in production).
            await embedKnowledgeDocument(chunk.embeddingText, job.source.title, []);
        embedded += 1;
        if (embedded % 5 === 0 || embedded === chunks.length) {
          await prisma.knowledgeIngestionJob.update({
            where: { id: jobId },
            data: {
              progress: 35 + Math.round((embedded / chunks.length) * 55),
            },
          });
        }
        return embedding;
      },
    );

    // Batch the DB writes: one createMany for all chunks (vectors stay null),
    // then one raw UPDATE ... FROM (VALUES ...) to set embedding + tsvector
    // for the whole version instead of ~2N separate round-trips.
    const chunkIds = chunks.map(() => randomUUID());
    await prisma.knowledgeChunk.createMany({
      data: chunks.map((chunk, index) => ({
        id: chunkIds[index],
        versionId: job.versionId,
        ordinal: index,
        content: chunk.content,
        section: chunk.section,
        pageNumber: chunk.pageNumber,
        sourceUrl: chunk.sourceUrl,
        tokenCount: chunk.tokenCount,
      })),
    });

    const vectorRows = chunks.map((chunk, index) => {
      const vector = `[${embeddings[index].join(",")}]`;
      return Prisma.sql`(${chunkIds[index]}::uuid, ${vector}::vector, ${chunk.content}::text)`;
    });
    for (let offset = 0; offset < vectorRows.length; offset += VECTOR_UPDATE_BATCH) {
      const batch = vectorRows.slice(offset, offset + VECTOR_UPDATE_BATCH);
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "KnowledgeChunk" AS c
        SET "embedding" = v.embedding,
            "searchVector" = to_tsvector('english', v.content)
        FROM (VALUES ${Prisma.join(batch, ",")}) AS v("id", "embedding", "content")
        WHERE c."id" = v."id"
      `);
    }

    await withTransientRetry(() =>
      prisma.$transaction(
        [
          prisma.knowledgeSourceVersion.update({
            where: { id: job.versionId },
            data: {
              checksum,
              status: "READY",
              extractedText,
              metadata: asJson(document.metadata ?? {}),
              embeddingModel: selectedEngine?.engine.storageModelId ?? null,
            },
          }),
          prisma.knowledgeIngestionJob.update({
            where: { id: jobId },
            data: {
              status: "COMPLETED",
              stage: "ready_for_approval",
              progress: 100,
              completedAt: new Date(),
            },
          }),
          prisma.knowledgeSource.update({
            where: { id: job.sourceId },
            data: {
              status: job.source.currentVersionId ? "APPROVED" : "DRAFT",
              lastIndexedAt: new Date(),
            },
          }),
        ],
        { timeout: 15_000 },
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge ingestion failed";
    await withTransientRetry(() =>
      prisma.$transaction(
        [
          prisma.knowledgeIngestionJob.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              stage: "failed",
              errorMessage: message,
              completedAt: new Date(),
            },
          }),
          prisma.knowledgeSourceVersion.update({
            where: { id: job.versionId },
            data: { status: "FAILED", errorMessage: message },
          }),
          prisma.knowledgeSource.update({
            where: { id: job.sourceId },
            data: { status: job.source.currentVersionId ? "APPROVED" : "FAILED" },
          }),
        ],
        { timeout: 15_000 },
      ),
    );
    console.error("Knowledge ingestion failed", { jobId, error: message });
  }
}
