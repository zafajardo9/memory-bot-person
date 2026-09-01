import { z } from "zod";

import { createNoteKnowledgeSource } from "@/db/knowledge-queries";
import { processKnowledgeJob } from "@/lib/knowledge/ingestion";
import { assertKnowledgeSourceCapacity } from "@/lib/knowledge/limits";
import { assertKnowledgeWriteRateLimit } from "@/lib/knowledge/rate-limit";
import {
  readCompanyKnowledge,
  searchCompanyKnowledge,
} from "@/lib/knowledge/retrieval";
import { knowledgeSearchSchema } from "@/lib/knowledge/validation";
import { prisma } from "@/lib/prisma";

import type { LanguageModel } from "ai";

export function createKnowledgeTools({
  userId,
  chatId,
  agentId,
  model,
  retrievalAvailable,
}: {
  userId: string;
  chatId: string;
  agentId: string;
  model: LanguageModel;
  /**
   * False when the agent has no approved knowledge sources: retrieval tools
   * (which embed the query and can fail noisily) are omitted entirely, while
   * the note tool stays available for admins to grow the notebook.
   */
  retrievalAvailable: boolean;
}) {
  return {
    ...(retrievalAvailable
      ? {
          searchCompanyKnowledge: {
            description:
              "Search the approved company knowledge base. Always use this first for company work, policy, process, project, responsibility, or how-to questions. Optionally narrow results with tags or a source type (NOTE, FILE, URL).",
            inputSchema: knowledgeSearchSchema,
            execute: async (input: z.infer<typeof knowledgeSearchSchema>) => {
              const { query, limit, tags, sourceType } = input;
              const { results, queryLogId } = await searchCompanyKnowledge({
                query,
                limit,
                tags,
                sourceType,
                userId,
                chatId,
                agentId,
                rerankModel: model,
              });
              return {
                query,
                queryLogId,
                found: results.length > 0,
                results,
                instruction:
                  results.length > 0
                    ? "Read the most relevant chunks with readCompanyKnowledge to widen context, then answer from the retrieved passages and cite every company claim."
                    : "Say that the answer was not found in approved company knowledge. General guidance must be clearly separated.",
              };
            },
          },
          readCompanyKnowledge: {
            description:
              "Read surrounding passages for relevant approved knowledge chunks returned by searchCompanyKnowledge. Use this to expand the context window around the most relevant hits before answering.",
            inputSchema: z.object({
              chunkIds: z.array(z.string().uuid()).min(1).max(20),
            }),
            execute: async ({ chunkIds }: { chunkIds: string[] }) => ({
              sources: await readCompanyKnowledge(chunkIds, agentId),
              instruction:
                "Answer from these passages and cite each company-specific claim.",
            }),
          },
          listCompanyKnowledgeSources: {
            description:
              "List the approved company knowledge sources currently available.",
            inputSchema: z.object({}),
            execute: async () => ({
              sources: await prisma.knowledgeSource.findMany({
                where: {
                  status: "APPROVED",
                  agents: { some: { agentId } },
                },
                orderBy: { title: "asc" },
                select: {
                  id: true,
                  title: true,
                  type: true,
                  tags: true,
                  lastIndexedAt: true,
                },
              }),
            }),
          },
        }
      : {}),
    addKnowledgeNote: {
      description:
        "Save a note into the company Notebook as a draft for administrator review. Only call this when the user explicitly asks to add, save, or remember this content in the knowledge base — never silently. Only administrators may use it.",
      inputSchema: z.object({
        title: z.string().trim().min(2).max(200),
        content: z
          .string()
          .trim()
          .min(10)
          .max(500_000)
          .describe("The note body in plain text or markdown. Do not include secrets or credentials."),
        tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
      }),
      execute: async (input: {
        title: string;
        content: string;
        tags: string[];
      }) => {
        const creator = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (creator?.role !== "ADMIN") {
          return {
            created: false,
            reason:
              "Only administrators can add knowledge to the Notebook. Ask an administrator to add it, or you can add it yourself on the /knowledge page.",
          };
        }

        try {
          await assertKnowledgeSourceCapacity();
          await assertKnowledgeWriteRateLimit(userId);
        } catch (error) {
          return {
            created: false,
            reason: error instanceof Error ? error.message : "Knowledge capacity check failed.",
          };
        }

        const created = await createNoteKnowledgeSource({
          title: input.title,
          content: input.content,
          tags: input.tags,
          createdById: userId,
          agentId,
        });
        // Mirror the upload route: index the note off the streaming path so
        // the tool returns immediately; the knowledge page polls job progress.
        processKnowledgeJob(created.job.id).catch((error) => {
          console.error("addKnowledgeNote ingestion failed", error);
        });

        return {
          created: true,
          sourceId: created.source.id,
          jobId: created.job.id,
          title: created.source.title,
          status: "DRAFT",
          note: "Saved as a draft. An administrator must publish it on the /knowledge page before it becomes searchable.",
        };
      },
    },
  };
}
