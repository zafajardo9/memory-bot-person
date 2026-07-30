import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  query: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/db/memory-queries", () => ({
  MEMORY_CATEGORIES: ["fact", "preference", "context", "note"],
  saveUserMemory: mocks.save,
  queryUserMemories: mocks.query,
  deleteUserMemory: mocks.remove,
}));

import { createUserMemoryTools } from "../../../ai/tools/user-memory";

describe("user memory tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always scopes saves to the authenticated user", async () => {
    mocks.save.mockResolvedValue({ id: "memory-id", title: "Preferred name" });
    const tools = createUserMemoryTools("authenticated-user", "agent-id");

    await tools.saveUserMemory.execute({
      title: "Preferred name",
      content: "Prefers Zac",
      tags: ["identity"],
      category: "preference",
      priority: 5,
    });

    expect(mocks.save).toHaveBeenCalledWith({
      userId: "authenticated-user",
      agentId: "agent-id",
      title: "Preferred name",
      content: "Prefers Zac",
      tags: ["identity"],
      category: "preference",
      priority: 5,
    });
  });

  it("passes both the memory id and authenticated user to deletion", async () => {
    const tools = createUserMemoryTools("authenticated-user", "agent-id");
    await tools.deleteUserMemory.execute({
      id: "00000000-0000-4000-8000-000000000001",
    });
    expect(mocks.remove).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "authenticated-user",
      "agent-id",
    );
  });
});
