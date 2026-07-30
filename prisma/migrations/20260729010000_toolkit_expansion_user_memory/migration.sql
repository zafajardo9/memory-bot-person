CREATE TABLE "UserMemory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "content" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "category" VARCHAR(50) NOT NULL DEFAULT 'fact',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserMemory_category_check"
    CHECK ("category" IN ('fact', 'preference', 'context', 'note')),
  CONSTRAINT "UserMemory_priority_check"
    CHECK ("priority" BETWEEN 0 AND 10),
  CONSTRAINT "UserMemory_source_check"
    CHECK ("source" IN ('manual', 'auto-extracted')),
  CONSTRAINT "UserMemory_title_check"
    CHECK (length(btrim("title")) BETWEEN 1 AND 200),
  CONSTRAINT "UserMemory_content_check"
    CHECK (length(btrim("content")) BETWEEN 1 AND 4000)
);

CREATE TABLE "WebSearchUsage" (
  "userId" UUID NOT NULL,
  "day" DATE NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WebSearchUsage_pkey" PRIMARY KEY ("userId", "day"),
  CONSTRAINT "WebSearchUsage_count_check" CHECK ("count" >= 0)
);

CREATE INDEX "UserMemory_userId_category_idx"
  ON "UserMemory"("userId", "category");

CREATE INDEX "UserMemory_userId_priority_updatedAt_idx"
  ON "UserMemory"("userId", "priority", "updatedAt");

ALTER TABLE "UserMemory"
  ADD CONSTRAINT "UserMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebSearchUsage"
  ADD CONSTRAINT "WebSearchUsage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
