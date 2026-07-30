import "server-only";

import { createAgentSchema, updateAgentSchema } from "@/lib/agents";
import { prisma } from "@/lib/prisma";

import type { CreateAgentInput, UpdateAgentInput } from "@/lib/agents";

function baseSlug(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "agent"
  );
}

async function availableSlug(userId: string, name: string) {
  const base = baseSlug(name);
  const existing = await prisma.agent.findMany({
    where: { userId, slug: { startsWith: base } },
    select: { slug: true },
  });
  const used = new Set(existing.map(({ slug }) => slug));
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base.slice(0, 52 - String(suffix).length)}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Unable to create a unique agent name.");
}

export async function ensureDefaultAgent(userId: string) {
  const existing = await prisma.agent.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (existing) return existing;

  const [legacySettings, legacySelection] = await Promise.all([
    prisma.userAgentSettings.findUnique({ where: { userId } }),
    prisma.userAiSelection.findUnique({ where: { userId } }),
  ]);
  return prisma.agent.create({
    data: {
      userId,
      slug: "memory",
      name: legacySettings?.agentName ?? "Memory",
      mood: legacySettings?.mood ?? "balanced",
      responseLength: legacySettings?.responseLength ?? "balanced",
      customInstructions: legacySettings?.customInstructions ?? "",
      providerId: legacySelection?.providerId,
      modelId: legacySelection?.modelId,
      isDefault: true,
      knowledgeSources: {
        create: (
          await prisma.knowledgeSource.findMany({ select: { id: true } })
        ).map(({ id }) => ({ sourceId: id })),
      },
    },
  });
}

export async function listAgents(userId: string) {
  await ensureDefaultAgent(userId);
  return prisma.agent.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: {
        select: { chats: true, memories: true, knowledgeSources: true },
      },
    },
  });
}

export async function getAgentForUser(agentId: string, userId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, userId },
    include: {
      _count: {
        select: { chats: true, memories: true, knowledgeSources: true },
      },
    },
  });
}

export async function getDefaultAgentForUser(userId: string) {
  return ensureDefaultAgent(userId);
}

export async function createAgent(userId: string, input: CreateAgentInput) {
  const values = createAgentSchema.parse(input);
  const count = await prisma.agent.count({ where: { userId } });
  if (count >= 24) {
    throw new Error("You can create up to 24 agents.");
  }
  return prisma.agent.create({
    data: {
      userId,
      slug: await availableSlug(userId, values.name),
      ...values,
      providerId: values.providerId || null,
      modelId: values.modelId || null,
      isDefault: count === 0,
    },
    include: {
      _count: {
        select: { chats: true, memories: true, knowledgeSources: true },
      },
    },
  });
}

export async function updateAgent(
  agentId: string,
  userId: string,
  input: UpdateAgentInput,
) {
  const existing = await getAgentForUser(agentId, userId);
  if (!existing) throw new Error("Agent not found.");
  const values = updateAgentSchema.parse(input);
  return prisma.agent.update({
    where: { id: agentId },
    data: {
      ...values,
      ...(values.name && values.name !== existing.name
        ? { slug: await availableSlug(userId, values.name) }
        : {}),
      providerId:
        values.providerId === undefined ? undefined : values.providerId || null,
      modelId: values.modelId === undefined ? undefined : values.modelId || null,
    },
    include: {
      _count: {
        select: { chats: true, memories: true, knowledgeSources: true },
      },
    },
  });
}

export async function setDefaultAgent(agentId: string, userId: string) {
  const agent = await getAgentForUser(agentId, userId);
  if (!agent) throw new Error("Agent not found.");
  await prisma.$transaction([
    prisma.agent.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.agent.update({
      where: { id: agentId },
      data: { isDefault: true },
    }),
  ]);
  return getAgentForUser(agentId, userId);
}

export async function deleteAgent(agentId: string, userId: string) {
  const agent = await getAgentForUser(agentId, userId);
  if (!agent) throw new Error("Agent not found.");
  if (agent.isDefault) {
    throw new Error("Choose another default agent before deleting this one.");
  }
  await prisma.agent.delete({ where: { id: agentId } });
}
