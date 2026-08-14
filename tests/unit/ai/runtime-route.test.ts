import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getWorkspaceAIRuntimeStatus: vi.fn(),
}));

vi.mock("@/lib/auth/permissions", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock("@/ai/providers/research-settings", () => ({
  getWorkspaceAIRuntimeStatus: mocks.getWorkspaceAIRuntimeStatus,
}));

import { GET } from "@/app/(chat)/api/ai/runtime/route";

const agentId = "00000000-0000-4000-8000-000000000001";

describe("workspace AI runtime route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);
    const response = await GET(
      new Request(`http://localhost/api/ai/runtime?agentId=${agentId}`),
    );
    expect(response.status).toBe(401);
  });

  it("returns only safe composer status", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-id", role: "MEMBER" });
    mocks.getWorkspaceAIRuntimeStatus.mockResolvedValue({
      available: true,
      thinkingProviderLabel: "Google Gemini",
      humanizerAvailable: true,
    });

    const response = await GET(
      new Request(`http://localhost/api/ai/runtime?agentId=${agentId}`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      available: true,
      thinkingProviderLabel: "Google Gemini",
      humanizerAvailable: true,
    });
    expect(mocks.getWorkspaceAIRuntimeStatus).toHaveBeenCalledWith(
      "user-id",
      agentId,
    );
  });

  it("rejects an invalid agent id", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-id", role: "MEMBER" });
    const response = await GET(
      new Request("http://localhost/api/ai/runtime?agentId=bad"),
    );
    expect(response.status).toBe(400);
  });
});
