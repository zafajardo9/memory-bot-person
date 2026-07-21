CREATE TABLE "AIProviderConfig" (
    "providerId" VARCHAR(50) NOT NULL,
    "encryptedValue" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultModelId" VARCHAR(200),
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIProviderConfig_pkey" PRIMARY KEY ("providerId")
);

CREATE TABLE "UserAISelection" (
    "userId" UUID NOT NULL,
    "providerId" VARCHAR(50) NOT NULL,
    "modelId" VARCHAR(200) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserAISelection_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "AIProviderConfig_updatedById_idx" ON "AIProviderConfig"("updatedById");
CREATE INDEX "UserAISelection_providerId_idx" ON "UserAISelection"("providerId");

ALTER TABLE "AIProviderConfig"
ADD CONSTRAINT "AIProviderConfig_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserAISelection"
ADD CONSTRAINT "UserAISelection_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AIProviderConfig" (
    "providerId",
    "encryptedValue",
    "enabled",
    "defaultModelId",
    "updatedById",
    "updatedAt"
)
SELECT
    'google',
    "encryptedValue",
    true,
    'gemini-3.5-flash',
    "updatedById",
    "updatedAt"
FROM "SystemSetting"
WHERE "key" = 'ai.gemini_api_key'
ON CONFLICT ("providerId") DO NOTHING;

DROP TABLE "SystemSetting";
