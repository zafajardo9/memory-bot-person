-- DropIndex
DROP INDEX "KnowledgeChunk_embedding_idx";

-- DropIndex
DROP INDEX "KnowledgeChunk_searchVector_idx";

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "responseLayers" JSONB,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserMemory" ALTER COLUMN "id" DROP DEFAULT;
