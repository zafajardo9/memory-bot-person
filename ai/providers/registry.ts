import { anthropicProviderAdapter } from "./anthropic";
import { deepseekProviderAdapter } from "./deepseek";
import { googleProviderAdapter } from "./google";
import { groqProviderAdapter } from "./groq";
import { mistralProviderAdapter } from "./mistral";
import { openAIProviderAdapter } from "./openai";

import type { AIProviderAdapter } from "./types";

const providerAdapters = [
  googleProviderAdapter,
  openAIProviderAdapter,
  anthropicProviderAdapter,
  deepseekProviderAdapter,
  mistralProviderAdapter,
  groqProviderAdapter,
] as const;

const providerRegistry = new Map<string, AIProviderAdapter>(
  providerAdapters.map((provider) => [provider.id, provider]),
);

export function listAIProviderAdapters() {
  return [...providerAdapters];
}

export function getAIProviderAdapter(providerId: string) {
  const provider = providerRegistry.get(providerId);
  if (!provider) throw new Error(`Unsupported AI provider: ${providerId}`);
  return provider;
}

export function isAIProviderId(providerId: string) {
  return providerRegistry.has(providerId);
}
