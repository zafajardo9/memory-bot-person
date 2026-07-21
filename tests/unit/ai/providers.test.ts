import { describe, expect, it } from "vitest";

import { isOpenAIChatModel } from "../../../ai/providers/openai";
import {
  getAIProviderAdapter,
  isAIProviderId,
  listAIProviderAdapters,
} from "../../../ai/providers/registry";

describe("AI provider registry", () => {
  it("registers Google and OpenAI behind the same adapter contract", () => {
    expect(listAIProviderAdapters().map((provider) => provider.id)).toEqual([
      "google",
      "openai",
    ]);
    expect(getAIProviderAdapter("google").environmentKey).toBe(
      "GOOGLE_GENERATIVE_AI_API_KEY",
    );
    expect(getAIProviderAdapter("openai").environmentKey).toBe("OPENAI_API_KEY");
  });

  it("rejects unknown provider identifiers", () => {
    expect(isAIProviderId("anthropic")).toBe(false);
    expect(() => getAIProviderAdapter("anthropic")).toThrow(
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
