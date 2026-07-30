-- Add optional ImageKit storage references to knowledge source versions
-- Existing rows keep NULL values and continue using database (BYTEA) storage.
ALTER TABLE "KnowledgeSourceVersion"
ADD COLUMN "storageProvider" VARCHAR(20),
ADD COLUMN "storageRef" VARCHAR(255);
