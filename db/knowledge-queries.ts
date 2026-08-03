import "server-only";

import { randomUUID } from "node:crypto";

import { prisma, withTransientRetry } from "@/lib/prisma";
import { isImageKitConfigured, uploadKnowledgeFile } from "@/lib/storage/imagekit";

import type { Prisma } from "@/lib/generated/prisma/client";

export function listKnowledgeSources(agentId?: string) {
  // Deliberately NOT cached: the UI polls this every 3s to show live job
  // progress, and an SWR cache would serve a stale snapshot for up to 30s.
  // Cold-start P6000 timeouts are handled by withTransientRetry at the route.
  return prisma.knowledgeSource.findMany({
    where: agentId ? { agents: { some: { agentId } } } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, email: true } },
      currentVersion: {
        select: { id: true, version: true, status: true, approvedAt: true },
      },
      versions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          approvedAt: true,
          _count: { select: { chunks: true } },
        },
      },
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          stage: true,
          progress: true,
          errorMessage: true,
        },
      },
    },
  });
}

export async function createNoteKnowledgeSource(input: {
  title: string;
  content: string;
  tags: string[];
  createdById: string;
  agentId: string;
}) {
  return createFileKnowledgeSource({
    title: input.title,
    mimeType: "text/markdown",
    bytes: new TextEncoder().encode(input.content),
    tags: input.tags,
    createdById: input.createdById,
    agentId: input.agentId,
    type: "NOTE",
  });
}

export function getKnowledgeSource(id: string) {
  // Not cached: the detail view reflects live version/job state after refreshes.
  return prisma.knowledgeSource.findUnique({
    where: { id },
    include: {
      currentVersion: true,
      versions: {
        orderBy: { version: "desc" },
        include: { _count: { select: { chunks: true } } },
      },
      jobs: { orderBy: { createdAt: "desc" } },
    },
  });
}

/** Minimal id + creator lookup used to authorize bulk operations. */
export function listKnowledgeSourceOwners(ids: string[]) {
  return prisma.knowledgeSource.findMany({
    where: { id: { in: ids } },
    select: { id: true, createdById: true, status: true },
  });
}

export async function createFileKnowledgeSource(input: {
  title: string;
  mimeType: string;
  bytes: Uint8Array;
  tags: string[];
  createdById: string;
  agentId: string;
  type?: "FILE" | "NOTE";
}) {
  // Upload to ImageKit if configured, otherwise store bytes in the database.
  let storageProvider: string | null = null;
  let storageRef: string | null = null;
  let originalContent: Uint8Array | null = input.bytes;

  if (isImageKitConfigured()) {
    try {
      const result = await uploadKnowledgeFile(
        input.title,
        input.bytes,
        input.mimeType,
      );
      storageProvider = "imagekit";
      storageRef = result.fileId;
      originalContent = null;
    } catch (error) {
      console.error("ImageKit upload failed, falling back to database storage:", error);
    }
  }

  return prisma.$transaction(async (tx) => {
    const source = await tx.knowledgeSource.create({
      data: {
        type: input.type ?? "FILE",
        title: input.title,
        mimeType: input.mimeType,
        tags: input.tags,
        createdById: input.createdById,
      },
    });
    await tx.agentKnowledgeSource.create({
      data: { agentId: input.agentId, sourceId: source.id },
    });
    const version = await tx.knowledgeSourceVersion.create({
      data: {
        sourceId: source.id,
        version: 1,
        checksum: `pending-${randomUUID()}`,
        originalContent: originalContent as Uint8Array<ArrayBuffer> | null,
        storageProvider,
        storageRef,
      },
    });
    const job = await tx.knowledgeIngestionJob.create({
      data: {
        sourceId: source.id,
        versionId: version.id,
        idempotencyKey: `${source.id}:1`,
      },
    });
    await tx.knowledgeAuditEvent.create({
      data: {
        actorId: input.createdById,
        sourceId: source.id,
        action: "source.created",
        metadata: { type: input.type ?? "FILE", title: input.title },
      },
    });
    return { source, version, job };
  });
}

export async function createUrlKnowledgeSource(input: {
  title: string;
  canonicalUrl: string;
  tags: string[];
  crawlDepth: number;
  crawlLimit: number;
  createdById: string;
  agentId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.knowledgeSource.create({
      data: {
        type: "URL",
        title: input.title,
        canonicalUrl: input.canonicalUrl,
        tags: input.tags,
        crawlDepth: input.crawlDepth,
        crawlLimit: input.crawlLimit,
        createdById: input.createdById,
      },
    });
    await tx.agentKnowledgeSource.create({
      data: { agentId: input.agentId, sourceId: source.id },
    });
    const version = await tx.knowledgeSourceVersion.create({
      data: {
        sourceId: source.id,
        version: 1,
        checksum: `pending-${randomUUID()}`,
      },
    });
    const job = await tx.knowledgeIngestionJob.create({
      data: {
        sourceId: source.id,
        versionId: version.id,
        idempotencyKey: `${source.id}:1`,
      },
    });
    await tx.knowledgeAuditEvent.create({
      data: {
        actorId: input.createdById,
        sourceId: source.id,
        action: "source.created",
        metadata: { type: "URL", url: input.canonicalUrl },
      },
    });
    return { source, version, job };
  });
}

export async function createRescanJob(
  sourceId: string,
  actorId: string,
  replacement?: { bytes: Uint8Array; mimeType: string },
) {
  // Resolve storage for the new version before opening the transaction.
  let storageProvider: string | null = null;
  let storageRef: string | null = null;
  let originalContent: Uint8Array | null = null;

  if (replacement && isImageKitConfigured()) {
    try {
      const source = await prisma.knowledgeSource.findUnique({
        where: { id: sourceId },
        select: { title: true },
      });
      const result = await uploadKnowledgeFile(
        source?.title ?? "rescanned-file",
        replacement.bytes,
        replacement.mimeType,
      );
      storageProvider = "imagekit";
      storageRef = result.fileId;
    } catch (error) {
      console.error("ImageKit upload failed for rescan, falling back to database:", error);
      originalContent = replacement.bytes;
    }
  }

  return prisma.$transaction(
    async (tx) => {
      const source = await tx.knowledgeSource.findUnique({
        where: { id: sourceId },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });
      if (!source) throw new Error("Knowledge source not found");
      if (source.status === "ARCHIVED") throw new Error("Archived sources cannot be rescanned");

      const latest = source.versions[0];

      // Carry forward the database bytes when no replacement is provided.
      if (!replacement && !storageProvider) {
        originalContent = latest?.originalContent ?? null;
      }

      // Carry forward ImageKit reference when re-scanning without replacement.
      if (!replacement && !storageProvider && latest?.storageProvider === "imagekit" && latest?.storageRef) {
        storageProvider = latest.storageProvider;
        storageRef = latest.storageRef;
      }

      const nextVersion = (latest?.version ?? 0) + 1;
      const version = await tx.knowledgeSourceVersion.create({
        data: {
          sourceId,
          version: nextVersion,
          checksum: `pending-${randomUUID()}`,
          originalContent: originalContent as Uint8Array<ArrayBuffer> | null,
          storageProvider,
          storageRef,
        },
      });
      const job = await tx.knowledgeIngestionJob.create({
        data: {
          sourceId,
          versionId: version.id,
          idempotencyKey: `${sourceId}:${nextVersion}`,
        },
      });
      if (replacement) {
        await tx.knowledgeSource.update({
          where: { id: sourceId },
          data: { mimeType: replacement.mimeType },
        });
      }
      await tx.knowledgeAuditEvent.create({
        data: { actorId, sourceId, action: "source.rescan_queued" },
      });
      return { source, version, job };
    },
    { timeout: 15_000 },
  );
}

/**
 * Queues a fresh scan for many sources at once (bulk refresh). Each source gets
 * a new version + ingestion job that re-crawls URLs or re-processes the stored
 * bytes of FILE/NOTE sources. No replacement content is supported here — it's
 * purely "re-learn what this source currently says".
 */
export async function createRescanJobs(
  sourceIds: string[],
  actorId: string,
): Promise<
  Array<{
    source: { id: string; title: string };
    version: { id: string; version: number };
    job: { id: string };
  }>
> {
  if (sourceIds.length === 0) return [];

  return prisma.$transaction(
    async (tx) => {
      const sources = await tx.knowledgeSource.findMany({
        where: { id: { in: sourceIds } },
        select: {
          id: true,
          title: true,
          status: true,
          versions: { orderBy: { version: "desc" }, take: 1 },
        },
      });

      const byId = new Map(sources.map((source) => [source.id, source]));

      const results: Array<{
        source: { id: string; title: string };
        version: { id: string; version: number };
        job: { id: string };
      }> = [];

      for (const sourceId of sourceIds) {
        const source = byId.get(sourceId);
        if (!source) throw new Error("Knowledge source not found");
        if (source.status === "ARCHIVED") {
          throw new Error(`"${source.title}" is archived and cannot be rescanned`);
        }

        const latest = source.versions[0];
        const nextVersion = (latest?.version ?? 0) + 1;

        const version = await tx.knowledgeSourceVersion.create({
          data: {
            sourceId,
            version: nextVersion,
            checksum: `pending-${randomUUID()}`,
            // Carry forward storage: URL sources re-crawl (no bytes), FILE/NOTE
            // sources re-process their existing bytes or ImageKit reference.
            originalContent:
              (latest?.originalContent ?? null) as Uint8Array<ArrayBuffer> | null,
            storageProvider: latest?.storageProvider ?? null,
            storageRef: latest?.storageRef ?? null,
          },
        });
        const job = await tx.knowledgeIngestionJob.create({
          data: {
            sourceId,
            versionId: version.id,
            idempotencyKey: `${sourceId}:${nextVersion}`,
          },
        });
        await tx.knowledgeAuditEvent.create({
          data: { actorId, sourceId, action: "source.bulk_rescan_queued" },
        });

        results.push({
          source: { id: source.id, title: source.title },
          version: { id: version.id, version: version.version },
          job: { id: job.id },
        });
      }

      return results;
    },
    { timeout: 15_000 },
  );
}

export async function approveKnowledgeVersion(sourceId: string, versionId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.knowledgeSourceVersion.findFirst({
      where: { id: versionId, sourceId, status: "READY" },
    });
    if (!version) throw new Error("Only a ready version can be approved");

    const source = await tx.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new Error("Knowledge source not found");

    if (source.currentVersionId && source.currentVersionId !== versionId) {
      await tx.knowledgeSourceVersion.update({
        where: { id: source.currentVersionId },
        data: { status: "ARCHIVED" },
      });
    }

    await tx.knowledgeSourceVersion.update({
      where: { id: versionId },
      data: { status: "APPROVED", approvedAt: new Date(), approvedById: actorId },
    });
    const updated = await tx.knowledgeSource.update({
      where: { id: sourceId },
      data: {
        status: "APPROVED",
        currentVersionId: versionId,
        archivedAt: null,
      },
    });
    await tx.knowledgeAuditEvent.create({
      data: {
        actorId,
        sourceId,
        action: "version.approved",
        metadata: { versionId, version: version.version },
      },
    });
    return updated;
  });
}

export async function archiveKnowledgeSource(sourceId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await tx.knowledgeAuditEvent.create({
      data: { actorId, sourceId, action: "source.archived" },
    });
    return source;
  });
}

export async function deleteKnowledgeSource(sourceId: string, actorId: string) {
  await prisma.knowledgeAuditEvent.create({
    data: { actorId, sourceId, action: "source.deleted" },
  });
  return prisma.knowledgeSource.delete({ where: { id: sourceId } });
}

export function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
