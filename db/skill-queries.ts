import "server-only";

import { prisma, withTransientRetry } from "@/lib/prisma";

import type { CreateSkillInput, UpdateSkillInput } from "@/lib/skills";

export class SkillNotFoundError extends Error {
  constructor() {
    super("Skill not found.");
    this.name = "SkillNotFoundError";
  }
}

const skillSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  instructions: true,
  enabled: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function listUserSkills(userId: string) {
  return withTransientRetry(() =>
    prisma.userSkill.findMany({
      where: { userId },
      orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
      select: skillSelect,
    }),
  );
}

export function countUserSkills(userId: string) {
  return withTransientRetry(() => prisma.userSkill.count({ where: { userId } }));
}

export function getUserSkillBySlug(userId: string, slug: string) {
  return withTransientRetry(() =>
    prisma.userSkill.findUnique({
      where: { userId_slug: { userId, slug } },
      select: skillSelect,
    }),
  );
}

export function createUserSkill(userId: string, input: CreateSkillInput) {
  return withTransientRetry(() =>
    prisma.userSkill.create({
      data: { userId, ...input },
      select: skillSelect,
    }),
  );
}

export async function updateUserSkill(
  userId: string,
  skillId: string,
  input: UpdateSkillInput,
) {
  const result = await withTransientRetry(() =>
    prisma.userSkill.updateMany({
      where: { id: skillId, userId },
      data: input,
    }),
  );
  if (result.count === 0) throw new SkillNotFoundError();

  const skill = await withTransientRetry(() =>
    prisma.userSkill.findFirst({
      where: { id: skillId, userId },
      select: skillSelect,
    }),
  );
  if (!skill) throw new SkillNotFoundError();
  return skill;
}

export async function deleteUserSkill(userId: string, skillId: string) {
  const result = await withTransientRetry(() =>
    prisma.userSkill.deleteMany({ where: { id: skillId, userId } }),
  );
  if (result.count === 0) throw new SkillNotFoundError();
}

export async function incrementSkillUsage(userId: string, skillId: string) {
  await withTransientRetry(() =>
    prisma.userSkill.updateMany({
      where: { id: skillId, userId, enabled: true },
      data: { usageCount: { increment: 1 } },
    }),
  );
}
