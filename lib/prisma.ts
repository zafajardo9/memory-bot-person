import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { withAccelerate } from "@prisma/extension-accelerate";

import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error("POSTGRES_URL is not defined");
  }

  if (
    connectionString.startsWith("prisma://") ||
    connectionString.startsWith("prisma+postgres://")
  ) {
    return new PrismaClient({ accelerateUrl: connectionString }).$extends(
      withAccelerate(),
    ) as unknown as PrismaClient;
  }

  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    max: 10,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const TRANSIENT_ERROR_MARKERS = [
  "P6000", // query timeout
  "P6001", // cache timeout
  "P6002", // connection timed out
  "P6003", // API could not be reached
  "P6004", // database unreachable
  "P2028", // transaction expired (rollback)
  "Accelerate experienced an error",
];

function isTransientAccelerateError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return TRANSIENT_ERROR_MARKERS.some(
    (marker) => error.message.includes(marker),
  );
}

const RETRY_DELAYS_MS = [750, 2_000];

/**
 * Retries a Prisma operation on transient Accelerate failures (cold start,
 * timeout, connection blip). Serverless DBs can take several seconds to wake
 * from idle and each timed-out attempt costs ~5s, so we back off a couple of
 * rounds instead of retrying once immediately.
 */
export async function withTransientRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (const delayMs of RETRY_DELAYS_MS) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientAccelerateError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Final attempt — any error (transient or not) propagates.
  return operation();
}
