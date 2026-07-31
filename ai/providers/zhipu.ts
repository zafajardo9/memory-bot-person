import { createOpenAI } from "@ai-sdk/openai";

import type { AIProviderAdapter, AIProviderModel } from "./types";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/";

async function listZhipuModels(_apiKey: string) {
  // Zhipu's model listing endpoint is not stable. Their chat models
  // are well-documented and change infrequently.
  const models: AIProviderModel[] = [
    {
      id: "glm-4-plus",
      label: "GLM-4 Plus",
      description:
        "Latest flagship — top-tier reasoning, coding, and instruction following.",
      chatCapable: true,
      inputTokenLimit: 128000,
      outputTokenLimit: 4096,
    },
    {
      id: "glm-4-flash",
      label: "GLM-4 Flash",
      description:
        "Fast, cost-effective model for everyday tasks — free tier available.",
      chatCapable: true,
      inputTokenLimit: 128000,
      outputTokenLimit: 4096,
    },
    {
      id: "glm-4-air",
      label: "GLM-4 Air",
      description:
        "Balanced performance and speed for general-purpose use.",
      chatCapable: true,
      inputTokenLimit: 128000,
      outputTokenLimit: 4096,
    },
    {
      id: "glm-4-long",
      label: "GLM-4 Long",
      description:
        "Extended context window (1M tokens) for long documents and transcripts.",
      chatCapable: true,
      inputTokenLimit: 1000000,
      outputTokenLimit: 4096,
    },
  ];

  return models;
}

export const zhipuProviderAdapter: AIProviderAdapter = {
  id: "zhipu",
  label: "Zhipu (GLM)",
  description:
    "Zhipu AI GLM-4 models — strong multilingual performance via OpenAI-compatible API.",
  environmentKey: "ZHIPU_API_KEY",
  defaultModelId: "glm-4-flash",
  createLanguageModel(apiKey, modelId) {
    return createOpenAI({
      apiKey,
      baseURL: ZHIPU_BASE_URL,
    }).chat(modelId);
  },
  listModels: listZhipuModels,
};
