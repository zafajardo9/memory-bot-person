import { createOpenAI } from "@ai-sdk/openai";

import type { AIProviderAdapter, AIProviderModel } from "./types";

interface CompatibleModelResponse {
  data?: Array<{ id?: string; owned_by?: string }>;
}

export function normalizeCompatibleBaseUrl(baseUrl: string) {
  const value = baseUrl.trim();
  if (!value || value.length > 500) {
    throw new Error("Enter an OpenAI-compatible base URL.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid provider URL, including http:// or https://.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Provider URLs must use HTTP or HTTPS without embedded credentials.");
  }
  return url.toString().replace(/\/$/, "");
}

export function createOpenAICompatibleAdapter(input: {
  id: string;
  label: string;
  baseUrl: string;
  defaultModelId: string;
}): AIProviderAdapter {
  const baseURL = normalizeCompatibleBaseUrl(input.baseUrl);

  return {
    id: input.id,
    label: input.label,
    description: `Custom OpenAI-compatible endpoint at ${new URL(baseURL).host}.`,
    environmentKey: "",
    defaultModelId: input.defaultModelId,
    createLanguageModel(apiKey, modelId) {
      return createOpenAI({ apiKey: apiKey || "not-required", baseURL }).chat(
        modelId,
      );
    },
    async listModels(apiKey) {
      const response = await fetch(`${baseURL}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if ([404, 405].includes(response.status)) return [];
      if (!response.ok) {
        throw new Error(
          [400, 401, 403].includes(response.status)
            ? `${input.label} rejected the API key or model-list request.`
            : `${input.label} model discovery failed with status ${response.status}.`,
        );
      }

      const body = (await response.json()) as CompatibleModelResponse;
      return (body.data ?? [])
        .filter((model): model is { id: string; owned_by?: string } =>
          Boolean(model.id),
        )
        .map<AIProviderModel>((model) => ({
          id: model.id,
          label: model.id,
          description: model.owned_by
            ? `Owned by ${model.owned_by}`
            : undefined,
          chatCapable: true,
          toolCallingCapable: true,
        }));
    },
  };
}
