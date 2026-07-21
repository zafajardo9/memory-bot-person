import { createGoogleGenerativeAI } from "@ai-sdk/google";

import type { AIProviderAdapter, AIProviderModel } from "./types";

interface GoogleModelResponse {
  models?: Array<{
    name?: string;
    displayName?: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedGenerationMethods?: string[];
  }>;
  nextPageToken?: string;
}

async function listGoogleModels(apiKey: string) {
  const models: AIProviderModel[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        [400, 401, 403].includes(response.status)
          ? "Google rejected this API key or project access."
          : `Google model discovery failed with status ${response.status}.`,
      );
    }

    const body = (await response.json()) as GoogleModelResponse;
    for (const model of body.models ?? []) {
      if (!model.name) continue;
      const id = model.name.replace(/^models\//, "");
      models.push({
        id,
        label: model.displayName?.trim() || id,
        description: model.description?.trim(),
        chatCapable:
          model.supportedGenerationMethods?.includes("generateContent") ?? false,
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit,
      });
    }

    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }

  return models;
}

export const googleProviderAdapter: AIProviderAdapter = {
  id: "google",
  label: "Google Gemini",
  description: "Gemini models available to your Google AI project.",
  environmentKey: "GOOGLE_GENERATIVE_AI_API_KEY",
  defaultModelId: "gemini-3.5-flash",
  createLanguageModel(apiKey, modelId) {
    return createGoogleGenerativeAI({ apiKey }).chat(modelId);
  },
  listModels: listGoogleModels,
};
