CREATE TABLE "IntegrationCredential" (
    "integrationId" VARCHAR(80) NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("integrationId")
);

CREATE INDEX "IntegrationCredential_updatedById_idx"
ON "IntegrationCredential"("updatedById");

ALTER TABLE "IntegrationCredential"
ADD CONSTRAINT "IntegrationCredential_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
