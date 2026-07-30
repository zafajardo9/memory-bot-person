import "server-only";

import {
  getIntegrationCredentialStatus,
  getIntegrationSecret,
} from "@/lib/integrations/service";

import { createWebSearchProvider } from "./registry";

export async function isWebSearchConfigured() {
  return (await getIntegrationCredentialStatus("tavily")).configured;
}

export async function getWebSearchProvider() {
  const apiKey = await getIntegrationSecret("tavily");
  return createWebSearchProvider("tavily", apiKey);
}
