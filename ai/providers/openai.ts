import { createOpenAI } from "@ai-sdk/openai";

import type { AIProviderAdapter, AIProviderModel } from "./types";

interface OpenAIModelResponse {
  data?: Array<{
    id?: string;
    created?: number;
    owned_by?: string;
  }>;
}

const unsupportedModelFragments = [
  "audio",
  "embedding",
  "image",
  "moderation",
  "realtime",
  "search-preview",
  "sora",
  "speech",
  "transcribe",
  "tts",
  "whisper",
];

export function isOpenAIChatModel(modelId: string) {
  const id = modelId.toLowerCase();
  if (unsupportedModelFragments.some((fragment) => id.includes(fragment))) {
    return false;
  }
  return (
    id.startsWith("gpt-") ||
    /^o\d/.test(id) ||
    id.startsWith("chatgpt-") ||
    id.startsWith("ft:gpt-") ||
    id.startsWith("ft:o")
  );
}

async function listOpenAIModels(apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      [400, 401, 403].includes(response.status)
        ? "OpenAI rejected this API key or project access."
        : `OpenAI model discovery failed with status ${response.status}.`,
    );
  }

  const body = (await response.json()) as OpenAIModelResponse;
  return (body.data ?? [])
    .filter((model): model is { id: string; created?: number; owned_by?: string } =>
      Boolean(model.id),
    )
    .map((model) => ({
      id: model.id,
      label: model.id,
      description: model.owned_by ? `Owned by ${model.owned_by}` : undefined,
      chatCapable: isOpenAIChatModel(model.id),
      toolCallingCapable: isOpenAIChatModel(model.id),
    }));
}

export const openAIProviderAdapter: AIProviderAdapter = {
  id: "openai",
  label: "OpenAI",
  description: "GPT and reasoning models available to your OpenAI project.",
  environmentKey: "OPENAI_API_KEY",
  defaultModelId: "gpt-5.6-sol",
  createLanguageModel(apiKey, modelId) {
    return createOpenAI({ apiKey }).responses(modelId);
  },
  listModels: listOpenAIModels,
};
