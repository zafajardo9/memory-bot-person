-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "researchDepth" TEXT DEFAULT 'quick';

-- AlterTable
ALTER TABLE "KnowledgeQueryLog" ADD COLUMN     "feedback" INTEGER;
