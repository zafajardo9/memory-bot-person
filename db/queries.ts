import "server-only";

import { genSaltSync, hashSync } from "bcrypt-ts";

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

  return prisma.user.create({
    data: {
      email: normalizedEmail,
      password: passwordHash,
      role: isConfiguredAdmin(normalizedEmail) ? "ADMIN" : "MEMBER",
    },
  });
}

export async function saveChat({
  id,
  messages,
  userId,
}: {
  id: string;
  messages: unknown;
  userId: string;
}) {
  const existing = await prisma.chat.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (existing && existing.userId !== userId) {
    throw new Error("Cannot update another user's chat");
  }

  return prisma.chat.upsert({
    where: { id },
    create: {
      id,
      messages: messages as unknown as Prisma.InputJsonValue,
      userId,
    },
    update: {
      messages: messages as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function deleteChatById({ id }: { id: string }) {
  return prisma.chat.delete({ where: { id } });
}

export async function getChatsByUserId({ id }: { id: string }) {
  return prisma.$queryRaw<Array<ChatSummary>>`
    SELECT
      "id",
      "createdAt",
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
