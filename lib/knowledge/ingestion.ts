import "server-only";

import { createHash } from "node:crypto";

import { asJson } from "@/db/knowledge-queries";
import { prisma } from "@/lib/prisma";
import { downloadKnowledgeFile } from "@/lib/storage/imagekit";

import { chunkSections } from "./chunking";
import { isKnowledgeIndexingEnabled } from "./config";
import { embedKnowledgeDocument, KNOWLEDGE_EMBEDDING_MODEL } from "./embeddings";
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

    const fetched = await fetchPublicKnowledgeUrl(next.url);
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

    sections.push(...document.sections);
    pages.push({ url: fetched.url, title: document.title });

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
    await prisma.knowledgeChunk.deleteMany({ where: { versionId: job.versionId } });

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const embedding = await embedKnowledgeDocument(chunk.embeddingText, job.source.title);
      const created = await prisma.knowledgeChunk.create({
        data: {
          versionId: job.versionId,
          ordinal: index,
          content: chunk.content,
          section: chunk.section,
          pageNumber: chunk.pageNumber,
          sourceUrl: chunk.sourceUrl,
          tokenCount: chunk.tokenCount,
        },
      });
      const vector = `[${embedding.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE "KnowledgeChunk"
        SET "embedding" = ${vector}::vector,
            "searchVector" = to_tsvector('english', ${chunk.content})
        WHERE "id" = ${created.id}::uuid
      `;

      if ((index + 1) % 5 === 0 || index === chunks.length - 1) {
        await prisma.knowledgeIngestionJob.update({
          where: { id: jobId },
          data: { progress: 35 + Math.round(((index + 1) / chunks.length) * 60) },
        });
      }
    }

    await prisma.$transaction(
      [
        prisma.knowledgeSourceVersion.update({
          where: { id: job.versionId },
          data: {
            checksum,
            status: "READY",
            extractedText,
            metadata: asJson(document.metadata ?? {}),
            embeddingModel: KNOWLEDGE_EMBEDDING_MODEL,
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
      { timeout: 30_000 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge ingestion failed";
    await prisma.$transaction(
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
      { timeout: 30_000 },
    );
    console.error("Knowledge ingestion failed", { jobId, error: message });
  }
}
