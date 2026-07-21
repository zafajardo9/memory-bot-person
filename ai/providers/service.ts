import "server-only";

import { prisma } from "@/lib/prisma";

import { decryptProviderSecret, encryptProviderSecret } from "./crypto";
import {
  clearProviderModelCache,
  discoverProviderModels,
} from "./model-cache";
import {
  getAIProviderAdapter,
  isAIProviderId,
  listAIProviderAdapters,
} from "./registry";

import type {
  AIProviderCatalog,
  AIProviderStatus,
  AISelection,
} from "./types";

function normalizeApiKey(apiKey: string) {
  const value = apiKey.trim();
  if (value.length < 20 || value.length > 500 || /\s/.test(value)) {
    throw new Error("Enter a valid provider API key.");
  }
  return value;
}

function environmentApiKey(providerId: string) {
  const adapter = getAIProviderAdapter(providerId);
  return process.env[adapter.environmentKey]?.trim() || null;
}

async function providerConfig(providerId: string) {
  return prisma.aiProviderConfig.findUnique({
    where: { providerId },
    include: { updatedBy: { select: { email: true } } },
  });
}

export async function getProviderApiKey(providerId: string) {
  const config = await providerConfig(providerId);
  if (config?.encryptedValue) return decryptProviderSecret(config.encryptedValue);
  const environmentKey = environmentApiKey(providerId);
  if (environmentKey) return environmentKey;
  throw new Error(`${getAIProviderAdapter(providerId).label} is not configured.`);
}

export async function getProviderStatus(
  providerId: string,
): Promise<AIProviderStatus> {
  const adapter = getAIProviderAdapter(providerId);
  const config = await providerConfig(providerId);
  const environmentKey = environmentApiKey(providerId);
  const siteKey = config?.encryptedValue
    ? decryptProviderSecret(config.encryptedValue)
    : null;
  const activeKey = siteKey ?? environmentKey;

  return {
    id: adapter.id,
    label: adapter.label,
    description: adapter.description,
    configured: Boolean(activeKey),
    enabled: config ? config.enabled : Boolean(activeKey),
    source: siteKey ? "SITE" : environmentKey ? "ENVIRONMENT" : "NONE",
    maskedKey: activeKey ? `••••••••${activeKey.slice(-4)}` : null,
    defaultModelId: config?.defaultModelId || adapter.defaultModelId,
    updatedAt: config?.updatedAt.toISOString() ?? null,
    updatedBy: config?.updatedBy.email ?? null,
  };
}

export function listProviderStatuses() {
  return Promise.all(
    listAIProviderAdapters().map((provider) => getProviderStatus(provider.id)),
  );
}

export async function getProviderModels(
  providerId: string,
  options: { forceRefresh?: boolean; requireEnabled?: boolean } = {},
) {
  const status = await getProviderStatus(providerId);
  if (!status.configured) throw new Error(`${status.label} is not configured.`);
  if (options.requireEnabled && !status.enabled) {
    throw new Error(`${status.label} is not enabled.`);
  }
  const adapter = getAIProviderAdapter(providerId);
  const apiKey = await getProviderApiKey(providerId);
  const models = await discoverProviderModels(
    adapter,
    apiKey,
    options.forceRefresh,
  );
  return models
    .filter((model) => model.chatCapable)
    .sort((left, right) => {
      if (left.id === status.defaultModelId) return -1;
      if (right.id === status.defaultModelId) return 1;
      return left.label.localeCompare(right.label);
    });
}

export async function testProviderConnection(
  providerId: string,
  apiKey?: string,
) {
  const adapter = getAIProviderAdapter(providerId);
  const key = apiKey ? normalizeApiKey(apiKey) : await getProviderApiKey(providerId);
  const models = await discoverProviderModels(adapter, key, true);
  const chatModels = models.filter((model) => model.chatCapable);
  if (chatModels.length === 0) {
    throw new Error(`${adapter.label} returned no chat-capable models.`);
  }
  return { modelCount: chatModels.length, models: chatModels };
}

export async function saveProviderConfiguration(input: {
  providerId: string;
  apiKey?: string;
  enabled: boolean;
  defaultModelId?: string;
  updatedById: string;
}) {
  if (!isAIProviderId(input.providerId)) {
    throw new Error("Unsupported AI provider.");
  }
  const existing = await providerConfig(input.providerId);
  const newKey = input.apiKey?.trim()
    ? normalizeApiKey(input.apiKey)
    : undefined;
  const availableKey =
    newKey ||
    (existing?.encryptedValue
      ? decryptProviderSecret(existing.encryptedValue)
      : environmentApiKey(input.providerId));

  if (input.enabled && !availableKey) {
    throw new Error("Add an API key before enabling this provider.");
  }

  let defaultModelId =
    input.defaultModelId?.trim() ||
    existing?.defaultModelId ||
    getAIProviderAdapter(input.providerId).defaultModelId;

  if (availableKey && (newKey || input.enabled || input.defaultModelId)) {
    const adapter = getAIProviderAdapter(input.providerId);
    const models = await discoverProviderModels(adapter, availableKey, true);
    const chatModels = models.filter((model) => model.chatCapable);
    if (chatModels.length === 0) {
      throw new Error(`${adapter.label} returned no chat-capable models.`);
    }
    if (!chatModels.some((model) => model.id === defaultModelId)) {
      if (input.defaultModelId) {
        throw new Error("The selected default model is not accessible to this key.");
      }
      defaultModelId = chatModels[0].id;
    }
  }

  await prisma.aiProviderConfig.upsert({
    where: { providerId: input.providerId },
    create: {
      providerId: input.providerId,
      encryptedValue: newKey ? encryptProviderSecret(newKey) : null,
      enabled: input.enabled,
      defaultModelId,
      updatedById: input.updatedById,
    },
    update: {
      encryptedValue: newKey ? encryptProviderSecret(newKey) : undefined,
      enabled: input.enabled,
      defaultModelId,
      updatedById: input.updatedById,
    },
  });
  clearProviderModelCache(input.providerId);
  return getProviderStatus(input.providerId);
}

export async function removeSiteProviderKey(
  providerId: string,
  updatedById: string,
) {
  const adapter = getAIProviderAdapter(providerId);
  await prisma.aiProviderConfig.upsert({
    where: { providerId },
    create: {
      providerId,
      encryptedValue: null,
      enabled: false,
      defaultModelId: adapter.defaultModelId,
      updatedById,
    },
    update: { encryptedValue: null, enabled: false, updatedById },
  });
  clearProviderModelCache(providerId);
  return getProviderStatus(providerId);
}

function modelInCatalog(
  providers: AIProviderCatalog["providers"],
  selection: AISelection,
) {
  return providers
    .find((provider) => provider.id === selection.providerId)
    ?.models.some((model) => model.id === selection.modelId);
}

export async function getAIProviderCatalog(
  userId: string,
  canConfigure: boolean,
): Promise<AIProviderCatalog> {
  const statuses = await listProviderStatuses();
  const providers = await Promise.all(
    statuses
      .filter((status) => status.enabled && status.configured)
      .map(async (status) => {
        try {
          return {
            id: status.id,
            label: status.label,
            description: status.description,
            defaultModelId: status.defaultModelId,
            models: await getProviderModels(status.id, { requireEnabled: true }),
          };
        } catch (error) {
          return {
            id: status.id,
            label: status.label,
            description: status.description,
            defaultModelId: status.defaultModelId,
            models: [],
            modelDiscoveryError:
              error instanceof Error ? error.message : "Model discovery failed.",
          };
        }
      }),
  );

  const stored = await prisma.userAiSelection.findUnique({ where: { userId } });
  let selection = stored
    ? { providerId: stored.providerId, modelId: stored.modelId }
    : null;

  if (!selection || !modelInCatalog(providers, selection)) {
    const firstProvider = providers.find((provider) => provider.models.length > 0);
    if (firstProvider) {
      const model =
        firstProvider.models.find(
          (candidate) => candidate.id === firstProvider.defaultModelId,
        ) ?? firstProvider.models[0];
      selection = { providerId: firstProvider.id, modelId: model.id };
      await prisma.userAiSelection.upsert({
        where: { userId },
        create: { userId, ...selection },
        update: selection,
      });
    } else {
      selection = null;
    }
  }

  return { providers, selection, canConfigure };
}

export async function saveUserAISelection(userId: string, selection: AISelection) {
  if (!isAIProviderId(selection.providerId)) {
    throw new Error("Unsupported AI provider.");
  }
  const status = await getProviderStatus(selection.providerId);
  if (!status.enabled || !status.configured) {
    throw new Error(`${status.label} is not available for chat.`);
  }
  const models = await getProviderModels(selection.providerId, {
    requireEnabled: true,
  });
  if (!models.some((model) => model.id === selection.modelId)) {
    throw new Error("The selected model is not accessible to this provider key.");
  }
  await prisma.userAiSelection.upsert({
    where: { userId },
    create: { userId, ...selection },
    update: selection,
  });
  return selection;
}

export async function resolveUserLanguageModel(userId: string) {
  const catalog = await getAIProviderCatalog(userId, false);
  if (!catalog.selection) {
    throw new Error(
      "No AI provider is available. An administrator must configure and enable one.",
    );
  }
  const adapter = getAIProviderAdapter(catalog.selection.providerId);
  const apiKey = await getProviderApiKey(adapter.id);
  return {
    ...catalog.selection,
    providerLabel: adapter.label,
    model: adapter.createLanguageModel(apiKey, catalog.selection.modelId),
  };
}
