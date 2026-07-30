import "server-only";

import { ensureDefaultAgent, getAgentForUser } from "@/db/agent-queries";
import { invalidateUserMemoryCache } from "@/lib/memory/cache";
import { userMemoryLimit } from "@/lib/memory/config";
import { prisma } from "@/lib/prisma";

export const MEMORY_CATEGORIES = [
  "fact",
  "preference",
  "context",
  "note",
] as const;
export const MEMORY_SOURCES = ["manual", "auto-extracted"] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export interface SaveUserMemoryInput {
  userId: string;
  agentId?: string;
  title: string;
  content: string;
  tags?: string[];
  category?: MemoryCategory;
  priority?: number;
  source?: MemorySource;
}

async function resolveAgentId(userId: string, agentId?: string) {
  if (!agentId) return (await ensureDefaultAgent(userId)).id;
  const agent = await getAgentForUser(agentId, userId);
  if (!agent) throw new Error("Agent not found.");
  return agent.id;
}

function normalizeTags(tags: string[] = []) {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10),
    ),
  ];
}

export async function saveUserMemory(input: SaveUserMemoryInput) {
  const agentId = await resolveAgentId(input.userId, input.agentId);
  const normalized = {
    title: input.title.trim(),
    content: input.content.trim(),
    tags: normalizeTags(input.tags),
    category: input.category ?? "fact",
    priority: input.priority ?? 0,
    source: input.source ?? "manual",
  };

  const memory = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.userMemory.findFirst({
        where: {
          userId: input.userId,
          agentId,
          title: { equals: normalized.title, mode: "insensitive" },
        },
      });

      if (existing) {
        return tx.userMemory.update({
          where: { id: existing.id },
          data: {
            ...normalized,
            source:
              existing.source === "manual" ? "manual" : normalized.source,
          },
        });
      }

      const count = await tx.userMemory.count({
        where: { agentId },
      });
      if (count >= userMemoryLimit()) {
        throw new Error(
          "Your saved-memory limit has been reached. Delete an old memory before adding another.",
        );
      }

      return tx.userMemory.create({
        data: { userId: input.userId, agentId, ...normalized },
      });
    },
    { isolationLevel: "Serializable" },
  );

  invalidateUserMemoryCache(agentId);
  return memory;
}

export async function queryUserMemories(input: {
  userId: string;
  agentId?: string;
  query?: string;
  category?: MemoryCategory;
  limit?: number;
}) {
  const agentId = await resolveAgentId(input.userId, input.agentId);
  const query = input.query?.trim();
  return prisma.userMemory.findMany({
    where: {
      userId: input.userId,
      agentId,
      category: input.category,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" as const } },
              { content: { contains: query, mode: "insensitive" as const } },
              { tags: { has: query.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: input.limit ?? 10,
  });
}

export async function listUserMemoriesForPreflight(
  userId: string,
  agentId?: string,
) {
  const resolvedAgentId = await resolveAgentId(userId, agentId);
  return prisma.userMemory.findMany({
    where: { userId, agentId: resolvedAgentId },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 15,
  });
}

export async function deleteUserMemory(
  id: string,
  userId: string,
  agentId?: string,
) {
  const resolvedAgentId = await resolveAgentId(userId, agentId);
  const result = await prisma.userMemory.deleteMany({
    where: { id, userId, agentId: resolvedAgentId },
  });
  if (result.count === 0) {
    throw new Error("Memory not found.");
  }
  invalidateUserMemoryCache(resolvedAgentId);
}
