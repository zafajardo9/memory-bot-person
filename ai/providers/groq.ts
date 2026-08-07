import { createGroq } from "@ai-sdk/groq";

import type { AIProviderAdapter, AIProviderModel } from "./types";

interface GroqModelResponse {
  data?: Array<{
    id?: string;
    created?: number;
    owned_by?: string;
  }>;
}

const nonChatModelFragments = [
  "audio",
  "embed",
  "image",
  "tts",
  "transcribe",
  "whisper",
];

export function isGroqChatModel(modelId: string) {
  const id = modelId.toLowerCase();
  return !nonChatModelFragments.some((fragment) => id.includes(fragment));
}

// Groq hosts open-weight models on their fast LPU hardware and changes the
// catalog regularly, so discover live instead of maintaining a static list.
async function listGroqModels(apiKey: string) {
  const response = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      [400, 401, 403].includes(response.status)
        ? "Groq rejected this API key or project access."
        : `Groq model discovery failed with status ${response.status}.`,
    );
  }

  const body = (await response.json()) as GroqModelResponse;
  return (body.data ?? [])
    .filter((model): model is { id: string; created?: number; owned_by?: string } =>
      Boolean(model.id),
    )
    .map((model) => ({
      id: model.id,
      label: model.id,
      description: model.owned_by ? `Owned by ${model.owned_by}` : undefined,
      chatCapable: isGroqChatModel(model.id),
    }));
}

export const groqProviderAdapter: AIProviderAdapter = {
  id: "groq",
  label: "Groq",
  description: "Ultra-fast inference on LPU hardware — open-weight models at low latency and high throughput.",
  environmentKey: "GROQ_API_KEY",
  defaultModelId: "openai/gpt-oss-120b",
  createLanguageModel(apiKey, modelId) {
    return createGroq({ apiKey })(modelId);
  },
  listModels: listGroqModels,
};
