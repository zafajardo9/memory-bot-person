import "server-only";

import { createTavilyProvider } from "@/lib/web/tavily";

interface IntegrationDefinition {
  id: string;
  label: string;
  description: string;
  environmentKey: string;
  normalizeSecret: (value: string) => string;
  testConnection: (value: string) => Promise<void>;
}

function normalizeApiKey(value: string) {
  const key = value.trim();
  if (key.length < 20 || key.length > 500 || /\s/.test(key)) {
    throw new Error("Enter a valid API key.");
  }
  return key;
}

const integrations = {
  tavily: {
    id: "tavily",
    label: "Tavily",
    description: "Live web search and source discovery for assistant responses.",
    environmentKey: "TAVILY_API_KEY",
    normalizeSecret: normalizeApiKey,
    testConnection: async (apiKey: string) => {
      await createTavilyProvider(apiKey).search("Tavily connection test", 1);
    },
  },
} satisfies Record<string, IntegrationDefinition>;

export type IntegrationId = keyof typeof integrations;

export function isIntegrationId(value: string): value is IntegrationId {
  return value in integrations;
}

export function getIntegrationDefinition(value: string) {
  if (!isIntegrationId(value)) {
    throw new Error("Unsupported integration.");
  }
  return integrations[value];
}
