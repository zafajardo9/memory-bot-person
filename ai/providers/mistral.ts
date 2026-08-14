import { createMistral } from "@ai-sdk/mistral";

import type { AIProviderAdapter, AIProviderModel } from "./types";

async function listMistralModels(_apiKey: string) {
  // Mistral's models endpoint requires the La Plateforme API.
  // The `-latest` aliases always point at the current generation and are the
  // recommended way to target Mistral models.
  const models: AIProviderModel[] = [
    {
      id: "mistral-large-latest",
      label: "Mistral Large 3",
      description: "Flagship model — top-tier reasoning for complex multilingual tasks with 256K context.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 262144,
      outputTokenLimit: 65536,
    },
    {
      id: "mistral-medium-latest",
      label: "Mistral Medium 3.5",
      description: "Balanced model for most professional tasks with strong cost-performance ratio.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 256000,
      outputTokenLimit: 32768,
    },
    {
      id: "mistral-small-latest",
      label: "Mistral Small 4",
      description: "Efficient, fast model for straightforward tasks and higher throughput at lower cost.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 128000,
      outputTokenLimit: 32768,
    },
    {
      id: "codestral-latest",
      label: "Codestral",
      description: "Code-specialized model — optimized for generation, completion, and refactoring tasks.",
      chatCapable: true,
      toolCallingCapable: true,
      inputTokenLimit: 262144,
      outputTokenLimit: 32768,
    },
  ];

  return models;
}

export const mistralProviderAdapter: AIProviderAdapter = {
  id: "mistral",
  label: "Mistral AI",
  description: "Mistral models — multilingual, code-capable, and available via La Plateforme.",
  environmentKey: "MISTRAL_API_KEY",
  defaultModelId: "mistral-large-latest",
  createLanguageModel(apiKey, modelId) {
    return createMistral({ apiKey }).chat(modelId);
  },
  listModels: listMistralModels,
};
