import type { AIProviderModel } from "./types";

export const MAX_CUSTOM_MODELS = 50;

export function normalizeCustomModelId(modelId: string) {
  const normalized = modelId.trim();
  if (!normalized || normalized.length > 200 || /\s/.test(normalized)) {
    throw new Error(
      "Model IDs must be 1–200 characters and cannot contain spaces.",
    );
  }
  return normalized;
}

export function normalizeCustomModelIds(modelIds: string[]) {
  const normalized = [...new Set(modelIds.map(normalizeCustomModelId))];
  if (normalized.length > MAX_CUSTOM_MODELS) {
    throw new Error(`Add no more than ${MAX_CUSTOM_MODELS} custom models.`);
  }
  return normalized;
}

export function mergeCustomModels(
  discoveredModels: AIProviderModel[],
  customModelIds: string[],
) {
  const knownIds = new Set(discoveredModels.map((model) => model.id));
  const customModels = normalizeCustomModelIds(customModelIds)
    .filter((modelId) => !knownIds.has(modelId))
    .map<AIProviderModel>((modelId) => ({
      id: modelId,
      label: modelId,
      description: "Custom workspace model ID",
      chatCapable: true,
      toolCallingCapable: true,
      custom: true,
    }));

  return [...discoveredModels, ...customModels];
}
