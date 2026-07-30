-- Create one durable assistant profile per user, then scope chats, memories,
-- knowledge retrieval, and notebook assignments to those profiles.
CREATE TABLE "Agent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(240) NOT NULL DEFAULT '',
    "avatar" VARCHAR(30) NOT NULL DEFAULT 'spark',
    "color" VARCHAR(30) NOT NULL DEFAULT 'violet',
    "mood" VARCHAR(30) NOT NULL DEFAULT 'balanced',
    "responseLength" VARCHAR(30) NOT NULL DEFAULT 'balanced',
    "customInstructions" TEXT NOT NULL DEFAULT '',
    "providerId" VARCHAR(50),
    "modelId" VARCHAR(200),
    "enabledTools" TEXT[] NOT NULL DEFAULT ARRAY['knowledge', 'memory', 'web', 'browser', 'weather', 'flights']::TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Agent_userId_slug_key" ON "Agent"("userId", "slug");
CREATE INDEX "Agent_userId_isDefault_idx" ON "Agent"("userId", "isDefault");
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Agent" (
  "userId", "slug", "name", "mood", "responseLength",
  "customInstructions", "providerId", "modelId", "isDefault"
)
SELECT
  u."id",
  'memory',
  COALESCE(s."agentName", 'Memory'),
  COALESCE(s."mood", 'balanced'),
  COALESCE(s."responseLength", 'balanced'),
  COALESCE(s."customInstructions", ''),
  ai."providerId",
  ai."modelId",
  true
FROM "User" u
LEFT JOIN "UserAgentSettings" s ON s."userId" = u."id"
LEFT JOIN "UserAISelection" ai ON ai."userId" = u."id";

ALTER TABLE "Chat" ADD COLUMN "agentId" UUID;
UPDATE "Chat" c
SET "agentId" = a."id"
FROM "Agent" a
WHERE a."userId" = c."userId" AND a."isDefault" = true;
ALTER TABLE "Chat" ALTER COLUMN "agentId" SET NOT NULL;
CREATE INDEX "Chat_agentId_createdAt_idx" ON "Chat"("agentId", "createdAt");
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMemory" ADD COLUMN "agentId" UUID;
UPDATE "UserMemory" m
SET "agentId" = a."id"
FROM "Agent" a
WHERE a."userId" = m."userId" AND a."isDefault" = true;
ALTER TABLE "UserMemory" ALTER COLUMN "agentId" SET NOT NULL;
CREATE INDEX "UserMemory_agentId_priority_updatedAt_idx"
  ON "UserMemory"("agentId", "priority", "updatedAt");
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeQueryLog" ADD COLUMN "agentId" UUID;
UPDATE "KnowledgeQueryLog" q
SET "agentId" = a."id"
FROM "Agent" a
WHERE a."userId" = q."userId" AND a."isDefault" = true;
ALTER TABLE "KnowledgeQueryLog" ALTER COLUMN "agentId" SET NOT NULL;
CREATE INDEX "KnowledgeQueryLog_agentId_createdAt_idx"
  ON "KnowledgeQueryLog"("agentId", "createdAt");
ALTER TABLE "KnowledgeQueryLog" ADD CONSTRAINT "KnowledgeQueryLog_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AgentKnowledgeSource" (
    "agentId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentKnowledgeSource_pkey" PRIMARY KEY ("agentId", "sourceId")
);
CREATE INDEX "AgentKnowledgeSource_sourceId_idx" ON "AgentKnowledgeSource"("sourceId");
ALTER TABLE "AgentKnowledgeSource" ADD CONSTRAINT "AgentKnowledgeSource_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentKnowledgeSource" ADD CONSTRAINT "AgentKnowledgeSource_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the prior shared-notebook behavior for every migrated default agent.
INSERT INTO "AgentKnowledgeSource" ("agentId", "sourceId")
SELECT a."id", s."id"
FROM "Agent" a
CROSS JOIN "KnowledgeSource" s
WHERE a."isDefault" = true;
