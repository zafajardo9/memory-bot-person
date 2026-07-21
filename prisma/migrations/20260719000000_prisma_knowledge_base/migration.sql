CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'ADMIN');
CREATE TYPE "KnowledgeSourceType" AS ENUM ('FILE', 'URL');
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('DRAFT', 'PROCESSING', 'APPROVED', 'FAILED', 'ARCHIVED');
CREATE TYPE "KnowledgeVersionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'APPROVED', 'FAILED', 'ARCHIVED');
CREATE TYPE "KnowledgeJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255),
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Chat" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messages" JSONB NOT NULL,
    "userId" UUID NOT NULL,
    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB NOT NULL,
    "hasCompletedPayment" BOOLEAN NOT NULL DEFAULT false,
    "userId" UUID NOT NULL,
    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeSource" (
    "id" UUID NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(200) NOT NULL,
    "canonicalUrl" TEXT,
    "mimeType" VARCHAR(150),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "crawlDepth" INTEGER NOT NULL DEFAULT 0,
    "crawlLimit" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "currentVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastIndexedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeSource_crawlDepth_check" CHECK ("crawlDepth" BETWEEN 0 AND 2),
    CONSTRAINT "KnowledgeSource_crawlLimit_check" CHECK ("crawlLimit" BETWEEN 1 AND 20)
);

CREATE TABLE "KnowledgeSourceVersion" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "status" "KnowledgeVersionStatus" NOT NULL DEFAULT 'QUEUED',
    "originalContent" BYTEA,
    "extractedText" TEXT,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "embeddingModel" VARCHAR(100),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeSourceVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeChunk" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "section" VARCHAR(500),
    "pageNumber" INTEGER,
    "sourceUrl" TEXT,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(768),
    "searchVector" tsvector,
    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeIngestionJob" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "status" "KnowledgeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" VARCHAR(50) NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "KnowledgeIngestionJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeIngestionJob_progress_check" CHECK ("progress" BETWEEN 0 AND 100)
);

CREATE TABLE "KnowledgeAuditEvent" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "sourceId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeQueryLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "chatId" UUID,
    "query" VARCHAR(1000) NOT NULL,
    "retrievedChunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resultCount" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeQueryLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Chat_userId_createdAt_idx" ON "Chat"("userId", "createdAt");
CREATE INDEX "Reservation_userId_createdAt_idx" ON "Reservation"("userId", "createdAt");
CREATE UNIQUE INDEX "KnowledgeSource_currentVersionId_key" ON "KnowledgeSource"("currentVersionId");
CREATE INDEX "KnowledgeSource_status_updatedAt_idx" ON "KnowledgeSource"("status", "updatedAt");
CREATE INDEX "KnowledgeSource_createdById_idx" ON "KnowledgeSource"("createdById");
CREATE INDEX "KnowledgeSourceVersion_sourceId_status_idx" ON "KnowledgeSourceVersion"("sourceId", "status");
CREATE UNIQUE INDEX "KnowledgeSourceVersion_sourceId_version_key" ON "KnowledgeSourceVersion"("sourceId", "version");
CREATE UNIQUE INDEX "KnowledgeSourceVersion_sourceId_checksum_key" ON "KnowledgeSourceVersion"("sourceId", "checksum");
CREATE INDEX "KnowledgeChunk_versionId_idx" ON "KnowledgeChunk"("versionId");
CREATE UNIQUE INDEX "KnowledgeChunk_versionId_ordinal_key" ON "KnowledgeChunk"("versionId", "ordinal");
CREATE INDEX "KnowledgeChunk_searchVector_idx" ON "KnowledgeChunk" USING GIN ("searchVector");
CREATE INDEX "KnowledgeChunk_embedding_idx" ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);
CREATE UNIQUE INDEX "KnowledgeIngestionJob_idempotencyKey_key" ON "KnowledgeIngestionJob"("idempotencyKey");
CREATE INDEX "KnowledgeIngestionJob_status_createdAt_idx" ON "KnowledgeIngestionJob"("status", "createdAt");
CREATE INDEX "KnowledgeIngestionJob_sourceId_idx" ON "KnowledgeIngestionJob"("sourceId");
CREATE INDEX "KnowledgeAuditEvent_sourceId_createdAt_idx" ON "KnowledgeAuditEvent"("sourceId", "createdAt");
CREATE INDEX "KnowledgeAuditEvent_actorId_createdAt_idx" ON "KnowledgeAuditEvent"("actorId", "createdAt");
CREATE INDEX "KnowledgeQueryLog_userId_createdAt_idx" ON "KnowledgeQueryLog"("userId", "createdAt");

ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "KnowledgeSourceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeSourceVersion" ADD CONSTRAINT "KnowledgeSourceVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeSourceVersion" ADD CONSTRAINT "KnowledgeSourceVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgeSourceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeIngestionJob" ADD CONSTRAINT "KnowledgeIngestionJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeIngestionJob" ADD CONSTRAINT "KnowledgeIngestionJob_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgeSourceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeAuditEvent" ADD CONSTRAINT "KnowledgeAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgeAuditEvent" ADD CONSTRAINT "KnowledgeAuditEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeQueryLog" ADD CONSTRAINT "KnowledgeQueryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
