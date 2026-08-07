import { describe, expect, it } from "vitest";

import {
  mergeCustomModels,
  normalizeCustomModelIds,
} from "../../../ai/providers/custom-models";
import { isOpenAIChatModel } from "../../../ai/providers/openai";
import { normalizeCompatibleBaseUrl } from "../../../ai/providers/openai-compatible";
import {
  getAIProviderAdapter,
  isAIProviderId,
  listAIProviderAdapters,
} from "../../../ai/providers/registry";

describe("AI provider registry", () => {
  it("registers all providers behind the same adapter contract", () => {
    expect(listAIProviderAdapters().map((provider) => provider.id)).toEqual([
      "google",
      "openai",
      "anthropic",
      "deepseek",
      "mistral",
      "groq",
      "huggingface",
      "zhipu",
    ]);
    expect(getAIProviderAdapter("google").environmentKey).toBe(
      "GOOGLE_GENERATIVE_AI_API_KEY",
    );
    expect(getAIProviderAdapter("openai").environmentKey).toBe("OPENAI_API_KEY");
    expect(getAIProviderAdapter("deepseek").environmentKey).toBe("DEEPSEEK_API_KEY");
    expect(getAIProviderAdapter("huggingface").environmentKey).toBe(
      "HUGGINGFACE_API_KEY",
    );
  });

  it("rejects unknown provider identifiers", () => {
    expect(isAIProviderId("nonexistent")).toBe(false);
    expect(() => getAIProviderAdapter("nonexistent")).toThrow(
      "Unsupported AI provider",
    );
  });
});

describe("OpenAI model discovery filtering", () => {
  it.each(["gpt-5.6-sol", "gpt-4.1", "o3", "chatgpt-4o-latest", "ft:gpt-4.1:team:model"])(
    "keeps chat-capable model %s",
    (modelId) => expect(isOpenAIChatModel(modelId)).toBe(true),
  );

  it.each(["text-embedding-3-large", "gpt-image-1", "whisper-1", "omni-moderation-latest", "gpt-4o-realtime-preview"])(
    "excludes incompatible model %s",
    (modelId) => expect(isOpenAIChatModel(modelId)).toBe(false),
  );
});

describe("custom provider models", () => {
  it("normalizes, deduplicates, and merges custom model IDs", () => {
    const customModelIds = normalizeCustomModelIds([
      "  vendor/new-model  ",
      "vendor/new-model",
      "vendor/preview-model",
    ]);

    expect(customModelIds).toEqual([
      "vendor/new-model",
      "vendor/preview-model",
    ]);
    expect(
      mergeCustomModels(
        [
          {
            id: "vendor/new-model",
            label: "New model",
            chatCapable: true,
          },
        ],
        customModelIds,
      ),
    ).toEqual([
      {
        id: "vendor/new-model",
        label: "New model",
        chatCapable: true,
      },
      {
        id: "vendor/preview-model",
        label: "vendor/preview-model",
        description: "Custom workspace model ID",
        chatCapable: true,
        custom: true,
      },
    ]);
  });

  it.each(["", "model with spaces", "x".repeat(201)])(
    "rejects invalid custom model ID %j",
    (modelId) => expect(() => normalizeCustomModelIds([modelId])).toThrow(),
  );
});

describe("OpenAI-compatible provider configuration", () => {
  it("normalizes a compatible API base URL", () => {
    expect(normalizeCompatibleBaseUrl(" https://gateway.example/v1/ ")).toBe(
      "https://gateway.example/v1",
    );
    expect(normalizeCompatibleBaseUrl("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1",
    );
  });

  it.each([
    "gateway.example/v1",
    "ftp://gateway.example/v1",
    "https://user:password@gateway.example/v1",
  ])("rejects unsafe or incomplete provider URL %s", (baseUrl) => {
    expect(() => normalizeCompatibleBaseUrl(baseUrl)).toThrow();
  });
});
