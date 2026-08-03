import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  getProviderApiKey: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeAiConfig: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));

vi.mock("@/ai/providers/service", () => ({
  getProviderApiKey: mocks.getProviderApiKey,
  getProviderStatus: mocks.getProviderStatus,
}));

import {
  getKnowledgeAISettings,
  resolveKnowledgeEmbeddingEngine,
  saveKnowledgeAISelection,
} from "@/lib/knowledge/embedding-settings";

describe("knowledge embedding settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(null);
    mocks.getProviderApiKey.mockResolvedValue("provider-key");
    mocks.getProviderStatus.mockImplementation(async (providerId: string) => ({
      id: providerId,
      label: providerId === "google" ? "Google Gemini" : "OpenAI",
      configured: true,
      enabled: true,
    }));
  });

  it("preserves the existing Google model as the workspace default", async () => {
    const settings = await getKnowledgeAISettings();

    expect(settings.selection).toEqual({
      providerId: "google",
      modelId: "gemini-embedding-2",
    });
    expect(settings.providers.map((provider) => provider.id)).toEqual([
      "google",
      "openai",
    ]);
  });

  it("resolves the saved OpenAI engine with its own vector-space identifier", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "workspace",
      providerId: "openai",
      modelId: "text-embedding-3-small",
      updatedAt: new Date("2026-08-03T07:00:00Z"),
      updatedBy: { email: "admin@example.com" },
    });

    await expect(resolveKnowledgeEmbeddingEngine()).resolves.toMatchObject({
      providerId: "openai",
      modelId: "text-embedding-3-small",
      storageModelId: "openai:text-embedding-3-small",
      apiKey: "provider-key",
    });
  });

  it("rejects a provider that is not connected and enabled", async () => {
    mocks.getProviderStatus.mockResolvedValue({
      id: "openai",
      label: "OpenAI",
      configured: false,
      enabled: false,
    });

    await expect(
      saveKnowledgeAISelection(
        { providerId: "openai", modelId: "text-embedding-3-small" },
        "admin-id",
      ),
    ).rejects.toThrow("OpenAI must be connected and enabled first");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
