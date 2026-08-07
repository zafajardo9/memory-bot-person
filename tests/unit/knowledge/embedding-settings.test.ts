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
  resolveKnowledgeEmbeddingEngines,
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
      "huggingface",
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

  it("includes other connected providers as embedding failover engines", async () => {
    // No saved config → Google default; OpenAI is also connected and enabled,
    // so it becomes the automatic fallback for knowledge processing.
    mocks.findUnique.mockResolvedValue(null);

    const engines = await resolveKnowledgeEmbeddingEngines();

    expect(engines.map((engine) => engine.providerId)).toEqual([
      "google",
      "openai",
      "huggingface",
    ]);
    expect(engines[0]).toMatchObject({ modelId: "gemini-embedding-2" });
    expect(engines[1]).toMatchObject({
      providerId: "openai",
      modelId: "text-embedding-3-small",
      storageModelId: "openai:text-embedding-3-small",
      apiKey: "provider-key",
    });
    expect(engines[2]).toMatchObject({
      providerId: "huggingface",
      modelId: "sentence-transformers/multi-qa-mpnet-base-dot-v1",
      storageModelId:
        "huggingface:sentence-transformers/multi-qa-mpnet-base-dot-v1",
      apiKey: "provider-key",
    });
  });

  it("excludes embedding providers that are not connected or enabled", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.getProviderStatus.mockImplementation(async (providerId: string) => ({
      id: providerId,
      label: providerId === "google" ? "Google Gemini" : "OpenAI",
      configured: providerId === "google",
      enabled: providerId === "google",
    }));

    const engines = await resolveKnowledgeEmbeddingEngines();

    expect(engines.map((engine) => engine.providerId)).toEqual(["google"]);
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
