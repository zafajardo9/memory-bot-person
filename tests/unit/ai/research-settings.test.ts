import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  getProviderModels: vi.fn(),
  getProviderStatus: vi.fn(),
  listProviderStatuses: vi.fn(),
  resolveProviderLanguageModel: vi.fn(),
  resolveUserLanguageModel: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceAiConfig: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));

vi.mock("@/ai/providers/service", () => ({
  getProviderModels: mocks.getProviderModels,
  getProviderStatus: mocks.getProviderStatus,
  listProviderStatuses: mocks.listProviderStatuses,
  resolveProviderLanguageModel: mocks.resolveProviderLanguageModel,
  resolveUserLanguageModel: mocks.resolveUserLanguageModel,
}));

import {
  getWorkspaceAISettings,
  resolveWorkspaceHumanizerModel,
  resolveWorkspaceResearchModel,
  saveWorkspaceAISelections,
  saveWorkspaceResearchSelection,
} from "@/ai/providers/research-settings";

const toolModel = {
  id: "research-model",
  label: "Research model",
  chatCapable: true,
  toolCallingCapable: true,
};

describe("workspace research model settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_RESEARCH_MODEL_ENABLED;
    mocks.findUnique.mockResolvedValue(null);
    mocks.listProviderStatuses.mockResolvedValue([
      {
        id: "openai",
        label: "OpenAI",
        description: "Provider",
        configured: true,
        enabled: true,
      },
    ]);
    mocks.getProviderStatus.mockResolvedValue({
      id: "openai",
      label: "OpenAI",
      configured: true,
      enabled: true,
    });
    mocks.getProviderModels.mockResolvedValue([toolModel]);
    mocks.resolveProviderLanguageModel.mockImplementation(
      async (providerId: string, modelId: string) => ({
        providerId,
        modelId,
        providerLabel: providerId === "google" ? "Google Gemini" : "OpenAI",
        model: { specificationVersion: "v3" },
      }),
    );
  });

  it("returns an explicit null selection when the workspace role is unset", async () => {
    const settings = await getWorkspaceAISettings();

    expect(settings.selection).toBeNull();
    expect(settings.providers[0].models).toEqual([toolModel]);
  });

  it("uses Google as the default Thinking provider before an admin saves roles", async () => {
    await expect(resolveWorkspaceResearchModel()).resolves.toMatchObject({
      providerId: "google",
      modelId: toolModel.id,
    });
    expect(mocks.getProviderStatus).toHaveBeenCalledWith("google");
    expect(mocks.resolveProviderLanguageModel).toHaveBeenCalledWith(
      "google",
      toolModel.id,
    );
  });

  it("keeps chat-only models available for the Humanizer role", async () => {
    mocks.getProviderModels.mockResolvedValue([
      toolModel,
      {
        id: "chat-only",
        label: "Chat only",
        chatCapable: true,
        toolCallingCapable: false,
      },
    ]);

    const settings = await getWorkspaceAISettings();

    expect(settings.providers[0].models.map((model) => model.id)).toEqual([
      "research-model",
      "chat-only",
    ]);
  });

  it("rejects a disabled provider before persisting", async () => {
    mocks.getProviderStatus.mockResolvedValue({
      id: "openai",
      label: "OpenAI",
      configured: true,
      enabled: false,
    });

    await expect(
      saveWorkspaceResearchSelection(
        { providerId: "openai", modelId: toolModel.id },
        "admin-id",
      ),
    ).rejects.toThrow("OpenAI must be connected and enabled first");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects a chat model without tool-calling support", async () => {
    mocks.getProviderModels.mockResolvedValue([
      { ...toolModel, toolCallingCapable: false },
    ]);

    await expect(
      saveWorkspaceResearchSelection(
        { providerId: "openai", modelId: toolModel.id },
        "admin-id",
      ),
    ).rejects.toThrow("thinking model does not support tool calling");
  });

  it("persists a chat-capable Humanizer even when it cannot call tools", async () => {
    const humanizerModel = {
      id: "humanizer-model",
      label: "Humanizer",
      chatCapable: true,
      toolCallingCapable: false,
    };
    mocks.getProviderModels.mockResolvedValue([toolModel, humanizerModel]);
    mocks.upsert.mockImplementation(async ({ create }) => {
      mocks.findUnique.mockResolvedValue({
        ...create,
        updatedAt: new Date("2026-08-14T00:00:00Z"),
        updatedBy: { email: "admin@example.com" },
      });
    });

    const settings = await saveWorkspaceAISelections(
      {
        thinkingSelection: { providerId: "openai", modelId: toolModel.id },
        humanizerSelection: {
          providerId: "openai",
          modelId: humanizerModel.id,
        },
      },
      "admin-id",
    );

    expect(settings.humanizerSelection).toEqual({
      providerId: "openai",
      modelId: humanizerModel.id,
    });
  });

  it("resolves the configured Humanizer and returns null when it is unset", async () => {
    await expect(resolveWorkspaceHumanizerModel()).resolves.toBeNull();

    mocks.findUnique.mockResolvedValue({
      researchProviderId: "openai",
      researchModelId: toolModel.id,
      humanizerProviderId: "openai",
      humanizerModelId: toolModel.id,
    });
    await expect(resolveWorkspaceHumanizerModel()).resolves.toMatchObject({
      providerId: "openai",
      modelId: toolModel.id,
    });
  });

  it("persists and returns a valid workspace selection", async () => {
    mocks.upsert.mockImplementation(async ({ create }) => {
      mocks.findUnique.mockResolvedValue({
        ...create,
        updatedAt: new Date("2026-08-14T00:00:00Z"),
        updatedBy: { email: "admin@example.com" },
      });
    });

    const settings = await saveWorkspaceResearchSelection(
      { providerId: "openai", modelId: toolModel.id },
      "admin-id",
    );

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "workspace" } }),
    );
    expect(settings.selection).toEqual({
      providerId: "openai",
      modelId: toolModel.id,
    });
  });

  it("resolves a ready model and falls back to null if the provider is disabled", async () => {
    mocks.findUnique.mockResolvedValue({
      researchProviderId: "openai",
      researchModelId: toolModel.id,
    });

    await expect(resolveWorkspaceResearchModel()).resolves.toMatchObject({
      providerId: "openai",
      modelId: toolModel.id,
    });

    mocks.getProviderStatus.mockResolvedValue({
      id: "openai",
      label: "OpenAI",
      configured: true,
      enabled: false,
    });
    await expect(resolveWorkspaceResearchModel()).resolves.toBeNull();
  });

  it("honors the emergency disable flag without touching provider services", async () => {
    process.env.AI_RESEARCH_MODEL_ENABLED = "false";
    mocks.findUnique.mockResolvedValue({
      researchProviderId: "openai",
      researchModelId: toolModel.id,
    });

    await expect(resolveWorkspaceResearchModel()).resolves.toBeNull();
    expect(mocks.getProviderStatus).not.toHaveBeenCalled();
  });
});
