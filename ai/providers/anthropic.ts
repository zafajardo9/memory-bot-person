import { createAnthropic } from "@ai-sdk/anthropic";

import type { AIProviderAdapter, AIProviderModel } from "./types";

async function listAnthropicModels(_apiKey: string) {
  // Anthropic doesn't offer a public list-models endpoint that returns
  // only the models accessible to a given API key. Their model IDs are
  // well-known and stable, so they're enumerated here with descriptions.
  const models: AIProviderModel[] = [
    {
      id: "claude-sonnet-4-20250514",
      label: "Claude Sonnet 4",
      description: "Best balance of speed, cost, and capability — recommended for most tasks.",
      chatCapable: true,
      inputTokenLimit: 200000,
      outputTokenLimit: 128000,
    },
    {
      id: "claude-opus-4-20250514",
      label: "Claude Opus 4",
      description: "Most capable Claude model for complex analysis, coding, and research.",
      chatCapable: true,
      inputTokenLimit: 200000,
      outputTokenLimit: 128000,
    },
    {
      id: "claude-haiku-4.5",
      label: "Claude Haiku 4.5",
      description: "Fastest and most cost-effective Claude model for quick responses.",
      chatCapable: true,
      inputTokenLimit: 200000,
      outputTokenLimit: 128000,
    },
  ];

  return models;
}

export const anthropicProviderAdapter: AIProviderAdapter = {
  id: "anthropic",
  label: "Anthropic",
  description: "Claude models — strong reasoning, long context, and thoughtful responses.",
  environmentKey: "ANTHROPIC_API_KEY",
  defaultModelId: "claude-sonnet-4-20250514",
  createLanguageModel(apiKey, modelId) {
    return createAnthropic({ apiKey }).chat(modelId);
  },
  listModels: listAnthropicModels,
};
