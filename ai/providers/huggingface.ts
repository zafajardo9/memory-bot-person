import { createOpenAI } from "@ai-sdk/openai";

import type { AIProviderAdapter, AIProviderModel } from "./types";

// HF Inference Providers expose an OpenAI-compatible API (chat completions,
// tool calls, streaming) through this router base URL.
const HUGGING_FACE_ROUTER_URL = "https://router.huggingface.co/v1";

async function listHuggingFaceModels(_apiKey: string) {
  // Hugging Face does not expose a per-key list-models endpoint. These are
  // popular conversational models served through Inference Providers. Note:
  // gated models (e.g. Llama) require accepting the model license in the
  // Hugging Face account that owns the token.
  const models: AIProviderModel[] = [
    {
      id: "mistralai/Mistral-7B-Instruct-v0.3",
      label: "Mistral 7B Instruct",
      description: "Fast, capable instruction-tuned 7B model — solid default for everyday chat.",
      chatCapable: true,
      inputTokenLimit: 32000,
      outputTokenLimit: 4096,
    },
    {
      id: "Qwen/Qwen2.5-7B-Instruct",
      label: "Qwen 2.5 7B Instruct",
      description: "Strong multilingual instruction model with good reasoning for its size.",
      chatCapable: true,
      inputTokenLimit: 32000,
      outputTokenLimit: 4096,
    },
    {
      id: "microsoft/Phi-4-mini-instruct",
      label: "Phi-4 Mini Instruct",
      description: "Compact 3.8B model with strong reasoning and tool-calling performance.",
      chatCapable: true,
      inputTokenLimit: 128000,
      outputTokenLimit: 8192,
    },
    {
      id: "meta-llama/Llama-3.3-70B-Instruct",
      label: "Llama 3.3 70B Instruct",
      description: "Large, high-quality instruction model — requires accepting the Llama license.",
      chatCapable: true,
      inputTokenLimit: 128000,
      outputTokenLimit: 8192,
    },
  ];

  return models;
}

export const huggingFaceProviderAdapter: AIProviderAdapter = {
  id: "huggingface",
  label: "Hugging Face",
  description:
    "Thousands of open models via Inference Providers — chat and knowledge embeddings.",
  environmentKey: "HUGGINGFACE_API_KEY",
  defaultModelId: "mistralai/Mistral-7B-Instruct-v0.3",
  createLanguageModel(apiKey, modelId) {
    // The HF router is OpenAI-compatible, so the existing OpenAI adapter is
    // pointed at it for chat completions.
    return createOpenAI({
      apiKey,
      baseURL: HUGGING_FACE_ROUTER_URL,
    }).chat(modelId);
  },
  listModels: listHuggingFaceModels,
};
