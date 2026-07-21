import "server-only";

import { createHash } from "node:crypto";

import type { AIProviderAdapter, AIProviderModel } from "./types";

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

interface ModelCacheEntry {
  expiresAt: number;
  models: AIProviderModel[];
}

const globalForModelCache = globalThis as unknown as {
  aiProviderModelCache?: Map<string, ModelCacheEntry>;
};

const modelCache =
  globalForModelCache.aiProviderModelCache ?? new Map<string, ModelCacheEntry>();

if (process.env.NODE_ENV !== "production") {
  globalForModelCache.aiProviderModelCache = modelCache;
}

function cacheKey(providerId: string, apiKey: string) {
  const keyHash = createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
  return `${providerId}:${keyHash}`;
}

export async function discoverProviderModels(
  adapter: AIProviderAdapter,
  apiKey: string,
  forceRefresh = false,
) {
  const key = cacheKey(adapter.id, apiKey);
  const cached = modelCache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.models;
  }

  const models = await adapter.listModels(apiKey);
  modelCache.set(key, {
    expiresAt: Date.now() + MODEL_CACHE_TTL_MS,
    models,
  });
  return models;
}

export function clearProviderModelCache(providerId?: string) {
  for (const key of modelCache.keys()) {
    if (!providerId || key.startsWith(`${providerId}:`)) modelCache.delete(key);
  }
}
