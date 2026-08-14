import { createDeepSeek } from "@ai-sdk/deepseek";

import type { AIProviderAdapter, AIProviderModel } from "./types";

async function listDeepSeekModels(_apiKey: string) {
  // DeepSeek API doesn't expose a public list-models endpoint.
  // The legacy `deepseek-chat` / `deepseek-reasoner` names were retired on
  // 2026-07-24; V4 is served under explicit model IDs.
  const models: AIProviderModel[] = [
    {
      id: "deepseek-v4-pro",
      label: "DeepSeek V4 Pro",
      description: "Flagship model — strongest reasoning and coding with 1M-token context.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 1000000,
      outputTokenLimit: 384000,
    },
    {
      id: "deepseek-v4-flash",
      label: "DeepSeek V4 Flash",
      description: "Fast, cost-effective model for everyday tasks with 1M-token context.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 1000000,
      outputTokenLimit: 384000,
    },
  ];

  return models;
}

export const deepseekProviderAdapter: AIProviderAdapter = {
  id: "deepseek",
  label: "DeepSeek",
  description: "DeepSeek V4 chat models — strong performance at lower cost.",
  environmentKey: "DEEPSEEK_API_KEY",
  defaultModelId: "deepseek-v4-flash",
  createLanguageModel(apiKey, modelId) {
    return createDeepSeek({ apiKey })(modelId);
  },
  listModels: listDeepSeekModels,
};
