import { z } from "zod";

import {
  deleteUserMemory,
  MEMORY_CATEGORIES,
  queryUserMemories,
  saveUserMemory,
} from "@/db/memory-queries";

const categorySchema = z.enum(MEMORY_CATEGORIES);

export function createUserMemoryTools(userId: string, agentId: string) {
  return {
    saveUserMemory: {
      description:
        "Save or update a durable fact, preference, or recurring context explicitly shared by this user. Do not save secrets, one-off requests, or guesses.",
      inputSchema: z.object({
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(1).max(4000),
        tags: z
          .array(z.string().trim().min(1).max(50))
          .max(10)
          .default([]),
        category: categorySchema.default("fact"),
        priority: z.number().int().min(0).max(10).default(0),
      }),
      execute: async (input: {
        title: string;
        content: string;
        tags: string[];
        category: "fact" | "preference" | "context" | "note";
        priority: number;
      }) => {
        const memory = await saveUserMemory({ userId, agentId, ...input });
        return { saved: true, id: memory.id, title: memory.title };
      },
    },
    listUserMemory: {
      description:
        "Search this user's private saved memories when the injected context is incomplete.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200).optional(),
        category: categorySchema.optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async (input: {
        query?: string;
        category?: "fact" | "preference" | "context" | "note";
        limit: number;
      }) => {
        const entries = await queryUserMemories({ userId, agentId, ...input });
        return {
          count: entries.length,
          entries: entries.map(
            ({ id, title, content, tags, category, priority, updatedAt }) => ({
              id,
              title,
              content,
              tags,
              category,
              priority,
              updatedAt,
            }),
          ),
        };
      },
    },
    deleteUserMemory: {
      description:
        "Delete one of this user's saved memories when they ask to forget it or identify it as outdated.",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }: { id: string }) => {
        await deleteUserMemory(id, userId, agentId);
        return { deleted: true, id };
      },
    },
  };
}
