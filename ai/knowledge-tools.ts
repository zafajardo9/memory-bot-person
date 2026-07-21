import { z } from "zod";

import {
  readCompanyKnowledge,
  searchCompanyKnowledge,
} from "@/lib/knowledge/retrieval";
import { knowledgeSearchSchema } from "@/lib/knowledge/validation";
import { prisma } from "@/lib/prisma";

export function createKnowledgeTools({ userId, chatId }: { userId: string; chatId: string }) {
  return {
    searchCompanyKnowledge: {
      description:
        "Search the approved company knowledge base. Always use this first for company work, policy, process, project, responsibility, or how-to questions.",
      inputSchema: knowledgeSearchSchema,
      execute: async ({ query, limit }: z.infer<typeof knowledgeSearchSchema>) => {
        const results = await searchCompanyKnowledge({ query, limit, userId, chatId });
        return {
          query,
          found: results.length > 0,
          results,
          instruction:
            results.length > 0
              ? "Use readCompanyKnowledge when you need surrounding context. Cite every company claim."
              : "Say that the answer was not found in approved company knowledge. General guidance must be clearly separated.",
        };
      },
    },
    readCompanyKnowledge: {
      description:
        "Read surrounding passages for relevant approved knowledge chunks returned by searchCompanyKnowledge.",
      inputSchema: z.object({
        chunkIds: z.array(z.string().uuid()).min(1).max(10),
      }),
      execute: async ({ chunkIds }: { chunkIds: string[] }) => ({
        sources: await readCompanyKnowledge(chunkIds),
        instruction: "Answer from these passages and cite each company-specific claim.",
      }),
    },
    listCompanyKnowledgeSources: {
      description: "List the approved company knowledge sources currently available.",
      inputSchema: z.object({}),
      execute: async () => ({
        sources: await prisma.knowledgeSource.findMany({
          where: { status: "APPROVED" },
          orderBy: { title: "asc" },
          select: { id: true, title: true, type: true, tags: true, lastIndexedAt: true },
        }),
      }),
    },
  };
}
