import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getWorkspaceAISettings: vi.fn(),
  saveWorkspaceResearchSelection: vi.fn(),
  saveWorkspaceAISelections: vi.fn(),
}));

vi.mock("@/lib/auth/permissions", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock("@/ai/providers/research-settings", () => ({
  getWorkspaceAISettings: mocks.getWorkspaceAISettings,
  saveWorkspaceResearchSelection: mocks.saveWorkspaceResearchSelection,
  saveWorkspaceAISelections: mocks.saveWorkspaceAISelections,
}));

import { GET, PUT } from "@/app/(chat)/api/ai/workspace/route";

describe("workspace research settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceAISettings.mockResolvedValue({
      selection: null,
      humanizerSelection: null,
      providers: [],
      updatedAt: null,
      updatedBy: null,
    });
  });

  it("persists Thinking and Humanizer roles together", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "admin", role: "ADMIN" });
    const selections = {
      thinkingSelection: { providerId: "google", modelId: "gemini" },
      humanizerSelection: { providerId: "openai", modelId: "gpt" },
    };
    mocks.saveWorkspaceAISelections.mockResolvedValue({
      selection: selections.thinkingSelection,
      humanizerSelection: selections.humanizerSelection,
      providers: [],
      updatedAt: null,
      updatedBy: null,
    });

    const response = await PUT(
      new Request("http://localhost/api/ai/workspace", {
        method: "PUT",
        body: JSON.stringify(selections),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.saveWorkspaceAISelections).toHaveBeenCalledWith(
      selections,
      "admin",
    );
  });

  it("rejects members for both reads and writes", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "member", role: "MEMBER" });

    expect((await GET()).status).toBe(403);
    expect(
      (
        await PUT(
          new Request("http://localhost/api/ai/workspace", {
            method: "PUT",
            body: JSON.stringify({ providerId: "openai", modelId: "gpt" }),
          }),
        )
      ).status,
    ).toBe(403);
  });

  it("validates malformed administrator payloads", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "admin", role: "ADMIN" });

    const response = await PUT(
      new Request("http://localhost/api/ai/workspace", {
        method: "PUT",
        body: JSON.stringify({ providerId: "", modelId: "" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.saveWorkspaceResearchSelection).not.toHaveBeenCalled();
  });

  it("persists a valid administrator selection", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "admin", role: "ADMIN" });
    mocks.saveWorkspaceResearchSelection.mockResolvedValue({
      selection: { providerId: "openai", modelId: "gpt" },
      providers: [],
      updatedAt: null,
      updatedBy: null,
    });

    const response = await PUT(
      new Request("http://localhost/api/ai/workspace", {
        method: "PUT",
        body: JSON.stringify({ providerId: "openai", modelId: "gpt" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.saveWorkspaceResearchSelection).toHaveBeenCalledWith(
      { providerId: "openai", modelId: "gpt" },
      "admin",
    );
  });
});
