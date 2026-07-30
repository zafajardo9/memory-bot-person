import "server-only";

import { prisma } from "@/lib/prisma";

import { webSearchDailyLimit } from "./config";

function utcDay(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function consumeWebSearchQuota(userId: string, now = new Date()) {
  const day = utcDay(now);
  const limit = webSearchDailyLimit();

  const count = await prisma.$transaction(async (tx) => {
    await tx.webSearchUsage.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, count: 0 },
      update: {},
    });
    const consumed = await tx.webSearchUsage.updateMany({
      where: { userId, day, count: { lt: limit } },
      data: { count: { increment: 1 } },
    });
    if (consumed.count === 0) {
      throw new Error(
        `Your daily web search limit of ${limit} has been reached.`,
      );
    }
    return tx.webSearchUsage.findUniqueOrThrow({
      where: { userId_day: { userId, day } },
      select: { count: true },
    });
  });

  return { used: count.count, limit, remaining: limit - count.count };
}

