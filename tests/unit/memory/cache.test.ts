import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearUserMemoryCache,
  getCachedUserMemories,
  invalidateUserMemoryCache,
} from "../../../lib/memory/cache";

import type { UserMemory } from "../../../lib/generated/prisma/client";

const memory = {
  id: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  agentId: "00000000-0000-4000-8000-000000000003",
  title: "Preferred name",
  content: "Prefers Zac",
  tags: ["identity"],
  category: "preference",
  priority: 5,
  source: "manual",
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies UserMemory;

describe("user memory cache", () => {
  afterEach(() => {
    clearUserMemoryCache();
    delete process.env.USER_MEMORY_CACHE_TTL_MS;
  });

  it("loads once within the TTL", async () => {
    const load = vi.fn().mockResolvedValue([memory]);
    await getCachedUserMemories(memory.userId, load, 1_000);
    await getCachedUserMemories(memory.userId, load, 1_001);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads after invalidation or expiry", async () => {
    process.env.USER_MEMORY_CACHE_TTL_MS = "10";
    const load = vi.fn().mockResolvedValue([memory]);
    await getCachedUserMemories(memory.userId, load, 1_000);
    invalidateUserMemoryCache(memory.userId);
    await getCachedUserMemories(memory.userId, load, 1_001);
    await getCachedUserMemories(memory.userId, load, 1_012);
    expect(load).toHaveBeenCalledTimes(3);
  });
});
