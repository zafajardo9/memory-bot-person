import { createDeepSeek } from "@ai-sdk/deepseek";

import type { AIProviderAdapter, AIProviderModel } from "./types";

async function listDeepSeekModels(_apiKey: string) {
  // DeepSeek API doesn't expose a public list-models endpoint.
  // Their known chat models are stable and well-documented.
  const models: AIProviderModel[] = [
    {
      id: "deepseek-chat",
      label: "DeepSeek V3",
      description: "Latest flagship model — strong general-purpose performance with 128K context.",
      chatCapable: true,
      inputTokenLimit: 128000,
      outputTokenLimit: 8192,
    },
    {
      id: "deepseek-reasoner",
      label: "DeepSeek R1",
      description: "Reasoning-focused model with chain-of-thought — best for complex analysis and math.",
      chatCapable: true,
      inputTokenLimit: 128000,
      outputTokenLimit: 8192,
    },
  ];

  return models;
}

export const deepseekProviderAdapter: AIProviderAdapter = {
  id: "deepseek",
  label: "DeepSeek",
  description: "DeepSeek chat and reasoning models — strong performance at lower cost.",
  environmentKey: "DEEPSEEK_API_KEY",
  defaultModelId: "deepseek-chat",
  createLanguageModel(apiKey, modelId) {
    return createDeepSeek({ apiKey })(modelId);
  },
  listModels: listDeepSeekModels,
};
