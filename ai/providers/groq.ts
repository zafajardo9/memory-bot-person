import { createGroq } from "@ai-sdk/groq";

import type { AIProviderAdapter, AIProviderModel } from "./types";

async function listGroqModels(_apiKey: string) {
  // Groq hosts third-party open-weight models on their fast LPU hardware.
  // Model availability changes regularly; these are the current chat-capable models.
  const models: AIProviderModel[] = [
    {
      id: "meta-llama/llama-4-maverick-17b-128e-instruct",
      label: "Llama 4 Maverick (17B)",
      description: "Meta's latest general-purpose model — strong all-around performance on Groq's fast LPU hardware.",
      chatCapable: true,
      inputTokenLimit: 131072,
      outputTokenLimit: 4096,
    },
    {
      id: "meta-llama/llama-4-scout-17b-16e-instruct",
      label: "Llama 4 Scout (17B)",
      description: "Long-context variant with up to 10M token context window for document-length tasks.",
      chatCapable: true,
      inputTokenLimit: 131072,
      outputTokenLimit: 4096,
    },
    {
      id: "qwen/qwen-3-235b-a22b",
      label: "Qwen 3 (235B MoE)",
      description: "Massive mixture-of-experts model — excellent for reasoning, coding, and multilingual tasks.",
      chatCapable: true,
      inputTokenLimit: 131072,
      outputTokenLimit: 4096,
    },
    {
      id: "deepseek/deepseek-r1-distill-llama-70b",
      label: "DeepSeek R1 Distill (70B)",
      description: "Distilled reasoning model — chain-of-thought for complex analysis at high speed.",
      chatCapable: true,
      inputTokenLimit: 131072,
      outputTokenLimit: 4096,
    },
  ];

  return models;
}

export const groqProviderAdapter: AIProviderAdapter = {
  id: "groq",
  label: "Groq",
  description: "Ultra-fast inference on LPU hardware — open-weight models at low latency and high throughput.",
  environmentKey: "GROQ_API_KEY",
  defaultModelId: "meta-llama/llama-4-maverick-17b-128e-instruct",
  createLanguageModel(apiKey, modelId) {
    return createGroq({ apiKey })(modelId);
  },
  listModels: listGroqModels,
};
