CREATE TABLE "WorkspaceAIConfig" (
    "id" VARCHAR(30) NOT NULL DEFAULT 'workspace',
    "researchProviderId" VARCHAR(50) NOT NULL,
    "researchModelId" VARCHAR(200) NOT NULL,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAIConfig_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceAIConfig_updatedById_idx"
ON "WorkspaceAIConfig"("updatedById");

ALTER TABLE "WorkspaceAIConfig"
ADD CONSTRAINT "WorkspaceAIConfig_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
