import "server-only";

import { getIntegrationDefinition } from "@/lib/integrations/registry";
import {
  getIntegrationCredentialStatus,
  getIntegrationSecret,
} from "@/lib/integrations/service";

import { createCombinedProvider } from "./combined";
import { webSearchProviderMode } from "./config";
import { createWebSearchProvider } from "./registry";

import type { WebSearchProvider } from "./types";

async function providerConfigured(providerId: string) {
  return (await getIntegrationCredentialStatus(providerId)).configured;
}

async function configuredProvider(providerId: string) {
  const apiKey = await getIntegrationSecret(providerId);
  return createWebSearchProvider(providerId, apiKey);
}

/** Providers this deployment is configured to use, in order, with display labels. */
export async function listActiveWebSearchProviders() {
  const mode = webSearchProviderMode();
  const activeIds =
    mode === "tavily" || mode === "tinyfish"
      ? (await providerConfigured(mode))
        ? [mode]
        : []
      : (
          await Promise.all(
            ["tavily", "tinyfish"].map(async (id) =>
              (await providerConfigured(id)) ? id : null,
            ),
          )
        ).filter((id): id is string => id !== null);
  return activeIds.map((id) => ({
    id,
    label: getIntegrationDefinition(id).label,
  }));
}

export async function isWebSearchConfigured() {
  return (await listActiveWebSearchProviders()).length > 0;
}

export async function getWebSearchProvider(): Promise<WebSearchProvider> {
  const active = await listActiveWebSearchProviders();
  if (active.length === 0) {
    throw new Error("No web search provider is configured.");
  }
  if (active.length === 1) {
    return configuredProvider(active[0].id);
  }
  const providers = await Promise.all(
    active.map((entry) => configuredProvider(entry.id)),
  );
  return createCombinedProvider(providers);
}
