import { createOpenAI } from "@ai-sdk/openai";

import type { AIProviderAdapter, AIProviderModel } from "./types";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/";

async function listZhipuModels(_apiKey: string) {
  // Zhipu's model listing endpoint is not stable. Their chat models
  // are well-documented; GLM-4-plus/4-flash/4-air were phased out in
  // favor of the GLM-5 and GLM-4.7 generation.
  const models: AIProviderModel[] = [
    {
      id: "glm-5.2",
      label: "GLM-5.2",
      description:
        "Latest flagship — 1M context, SOTA coding and long-horizon agentic tasks.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 1000000,
      outputTokenLimit: 128000,
    },
    {
      id: "glm-5.1",
      label: "GLM-5.1",
      description:
        "Frontier reasoning and coding, aligned with leading Western frontier models.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 200000,
      outputTokenLimit: 128000,
    },
    {
      id: "glm-5",
      label: "GLM-5",
      description:
        "Strong agentic planning and execution for long-running tasks.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 200000,
      outputTokenLimit: 128000,
    },
    {
      id: "glm-4.7-flash",
      label: "GLM-4.7 Flash",
      description:
        "Fast, lightweight model with a generous free tier — good for everyday chat.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 200000,
      outputTokenLimit: 128000,
    },
    {
      id: "glm-4.7-flashx",
      label: "GLM-4.7 FlashX",
      description:
        "Small, high-speed model for writing, translation, and general-purpose tasks.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 200000,
      outputTokenLimit: 128000,
    },
  ];

  return models;
}

export const zhipuProviderAdapter: AIProviderAdapter = {
  id: "zhipu",
  label: "Zhipu (GLM)",
  description:
    "Zhipu AI GLM models — strong multilingual performance via OpenAI-compatible API.",
  environmentKey: "ZHIPU_API_KEY",
  defaultModelId: "glm-4.7-flash",
  createLanguageModel(apiKey, modelId) {
    return createOpenAI({
      apiKey,
      baseURL: ZHIPU_BASE_URL,
    }).chat(modelId);
  },
  listModels: listZhipuModels,
};
