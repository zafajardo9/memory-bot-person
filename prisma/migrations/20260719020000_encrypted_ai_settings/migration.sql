CREATE TABLE "SystemSetting" (
    "key" VARCHAR(100) NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "SystemSetting_updatedById_idx" ON "SystemSetting"("updatedById");

ALTER TABLE "SystemSetting"
ADD CONSTRAINT "SystemSetting_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
