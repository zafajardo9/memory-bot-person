import { createMistral } from "@ai-sdk/mistral";

import type { AIProviderAdapter, AIProviderModel } from "./types";

async function listMistralModels(_apiKey: string) {
  // Mistral's models endpoint requires the La Plateforme API.
  // Known chat models are enumerated here with descriptions.
  const models: AIProviderModel[] = [
    {
      id: "mistral-large-latest",
      label: "Mistral Large",
      description: "Flagship model — top-tier reasoning for complex multilingual tasks with 128K context.",
      chatCapable: true,
      inputTokenLimit: 128000,
      outputTokenLimit: 4096,
    },
    {
      id: "mistral-medium-latest",
      label: "Mistral Medium",
      description: "Balanced model for most professional tasks with strong cost-performance ratio.",
      chatCapable: true,
      inputTokenLimit: 32000,
      outputTokenLimit: 4096,
    },
    {
      id: "mistral-small-latest",
      label: "Mistral Small",
      description: "Efficient, fast model for straightforward tasks and higher throughput at lower cost.",
      chatCapable: true,
      inputTokenLimit: 32000,
      outputTokenLimit: 4096,
    },
    {
      id: "codestral-latest",
      label: "Codestral",
      description: "Code-specialized model — optimized for generation, completion, and refactoring tasks.",
      chatCapable: true,
      inputTokenLimit: 32000,
      outputTokenLimit: 4096,
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
