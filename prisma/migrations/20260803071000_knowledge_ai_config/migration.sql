CREATE TABLE "KnowledgeAIConfig" (
    "id" VARCHAR(30) NOT NULL DEFAULT 'workspace',
    "providerId" VARCHAR(50) NOT NULL,
    "modelId" VARCHAR(200) NOT NULL,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeAIConfig_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeAIConfig_updatedById_idx"
ON "KnowledgeAIConfig"("updatedById");

ALTER TABLE "KnowledgeAIConfig"
ADD CONSTRAINT "KnowledgeAIConfig_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
