import { createTavilyProvider } from "./tavily";
import { createTinyFishProvider } from "./tinyfish";

import type { WebSearchProvider } from "./types";

const providerFactories = new Map<
  string,
  (apiKey: string) => WebSearchProvider
>([
  ["tavily", createTavilyProvider],
  ["tinyfish", createTinyFishProvider],
]);

export function listWebSearchProviderIds() {
  return [...providerFactories.keys()];
}

export function createWebSearchProvider(providerId: string, apiKey: string) {
  const factory = providerFactories.get(providerId);
  if (!factory) {
    throw new Error(`Unsupported web search provider: ${providerId}`);
  }
  return factory(apiKey);
}

