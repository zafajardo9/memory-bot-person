import "server-only";

import { genSaltSync, hashSync } from "bcrypt-ts";

import { ensureDefaultAgent } from "@/db/agent-queries";
import { prisma } from "@/lib/prisma";

import type { ChatSummary, User } from "./types";
import type { Prisma } from "@/lib/generated/prisma/client";

function isConfiguredAdmin(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function getUser(email: string): Promise<Array<User>> {
  const users = await prisma.user.findMany({
    where: { email: email.toLowerCase() },
  });

  if (users[0] && users[0].role !== "ADMIN" && isConfiguredAdmin(users[0].email)) {
    users[0] = await prisma.user.update({
      where: { id: users[0].id },
      data: { role: "ADMIN" },
    });
  }

  return users;
}

export async function createUser(email: string, password: string) {
  const normalizedEmail = email.toLowerCase();
  const passwordHash = hashSync(password, genSaltSync(10));

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: passwordHash,
      role: isConfiguredAdmin(normalizedEmail) ? "ADMIN" : "MEMBER",
    },
  });
  await ensureDefaultAgent(user.id);
  return user;
}

export async function saveChat({
  id,
  messages,
  userId,
  agentId,
  researchDepth,
}: {
  id: string;
  messages: unknown;
  userId: string;
  agentId: string;
  researchDepth?: string;
}) {
  const existing = await prisma.chat.findUnique({
    where: { id },
    select: { userId: true, agentId: true },
  });

  if (existing && existing.userId !== userId) {
    throw new Error("Cannot update another user's chat");
  }
  if (existing && existing.agentId !== agentId) {
    throw new Error("A chat cannot be moved to another agent.");
  }
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId },
    select: { id: true },
  });
  if (!agent) throw new Error("Agent not found.");

  return prisma.chat.upsert({
    where: { id },
    create: {
      id,
      messages: messages as unknown as Prisma.InputJsonValue,
      userId,
      agentId,
      ...(researchDepth ? { researchDepth } : {}),
    },
    update: {
      messages: messages as unknown as Prisma.InputJsonValue,
      ...(researchDepth ? { researchDepth } : {}),
    },
  });
}

export async function deleteChatById({ id }: { id: string }) {
  return prisma.chat.delete({ where: { id } });
}

export async function getChatsByUserId({
  id,
  agentId,
}: {
  id: string;
  agentId?: string;
}) {
  return prisma.$queryRaw<Array<ChatSummary>>`
    SELECT
      "id",
      "createdAt",
      "agentId",
      LEFT(
        COALESCE(
          NULLIF("messages"->0->'parts'->0->>'text', ''),
          NULLIF("messages"->0->>'content', ''),
          NULLIF("messages"->0->'content'->0->>'text', ''),
          'Untitled conversation'
        ),
        120
      ) AS "title"
    FROM "Chat"
    WHERE "userId" = ${id}::uuid
      AND (${agentId ?? null}::uuid IS NULL OR "agentId" = ${agentId ?? null}::uuid)
    ORDER BY "createdAt" DESC
    LIMIT 100
  `;
}

export async function getChatById({ id }: { id: string }) {
  return prisma.chat.findUnique({ where: { id } });
}

export async function createReservation({
  id,
  userId,
  details,
}: {
  id: string;
  userId: string;
  details: Prisma.InputJsonValue;
}) {
  return prisma.reservation.create({
    data: { id, userId, details },
  });
}

export async function getReservationById({ id }: { id: string }) {
  return prisma.reservation.findUnique({ where: { id } });
}

export async function updateReservation({
  id,
  hasCompletedPayment,
}: {
  id: string;
  hasCompletedPayment: boolean;
}) {
  return prisma.reservation.update({
    where: { id },
    data: { hasCompletedPayment },
  });
}
