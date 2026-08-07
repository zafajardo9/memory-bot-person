import { createAnthropic } from "@ai-sdk/anthropic";

import type { AIProviderAdapter, AIProviderModel } from "./types";

async function listAnthropicModels(_apiKey: string) {
  // Anthropic doesn't offer a public list-models endpoint that returns
  // only the models accessible to a given API key. Their model IDs are
  // well-known and stable, so they're enumerated here with descriptions.
  // Source of truth: anthropics/skills claude-api model catalog.
  const models: AIProviderModel[] = [
    {
      id: "claude-sonnet-5",
      label: "Claude Sonnet 5",
      description: "Best balance of speed, intelligence, and cost — recommended for most tasks. 1M context.",
      chatCapable: true,
      inputTokenLimit: 1000000,
      outputTokenLimit: 128000,
    },
    {
      id: "claude-opus-5",
      label: "Claude Opus 5",
      description: "Frontier model for complex agentic coding, research, and long-horizon work. 1M context.",
      chatCapable: true,
      inputTokenLimit: 1000000,
      outputTokenLimit: 128000,
    },
    {
      id: "claude-sonnet-4-6",
      label: "Claude Sonnet 4.6",
      description: "Previous-generation Sonnet — strong coding and computer use with 1M-token context.",
      chatCapable: true,
      inputTokenLimit: 1000000,
      outputTokenLimit: 128000,
    },
    {
      id: "claude-opus-4-8",
      label: "Claude Opus 4.8",
      description: "Most capable Opus 4-series model — highly autonomous, long-horizon agentic work.",
      chatCapable: true,
      inputTokenLimit: 1000000,
      outputTokenLimit: 128000,
    },
    {
      id: "claude-haiku-4-5",
      label: "Claude Haiku 4.5",
      description: "Fastest and most cost-effective Claude model for quick responses. 200K context.",
      chatCapable: true,
      inputTokenLimit: 200000,
      outputTokenLimit: 64000,
    },
  ];

  return models;
}

export const anthropicProviderAdapter: AIProviderAdapter = {
  id: "anthropic",
  label: "Anthropic",
  description: "Claude models — strong reasoning, long context, and thoughtful responses.",
  environmentKey: "ANTHROPIC_API_KEY",
  defaultModelId: "claude-sonnet-5",
  createLanguageModel(apiKey, modelId) {
    return createAnthropic({ apiKey }).chat(modelId);
  },
  listModels: listAnthropicModels,
};
