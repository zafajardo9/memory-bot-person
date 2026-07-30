import { userMemoryCacheTtlMs } from "./config";

import type { UserMemory } from "@/lib/generated/prisma/client";

interface CacheEntry {
  expiresAt: number;
  memories: UserMemory[];
}

const memoryCache = new Map<string, CacheEntry>();

export async function getCachedUserMemories(
  userId: string,
  load: () => Promise<UserMemory[]>,
  now = Date.now(),
) {
  const cached = memoryCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.memories;

  const memories = await load();
  memoryCache.set(userId, {
    expiresAt: now + userMemoryCacheTtlMs(),
    memories,
  });
  return memories;
}

export function invalidateUserMemoryCache(userId: string) {
  memoryCache.delete(userId);
}

export function clearUserMemoryCache() {
  memoryCache.clear();
}

