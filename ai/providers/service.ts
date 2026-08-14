import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

import { decryptProviderSecret, encryptProviderSecret } from "./crypto";
import {
  mergeCustomModels,
  normalizeCustomModelIds,
} from "./custom-models";
import {
  clearProviderModelCache,
  discoverProviderModels,
} from "./model-cache";
import {
  createOpenAICompatibleAdapter,
  normalizeCompatibleBaseUrl,
} from "./openai-compatible";
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

function normalizeCustomApiKey(apiKey: string) {
  const value = apiKey.trim();
  if (!value || value.length > 500 || /\s/.test(value)) {
    throw new Error("Enter a valid provider API key.");
  }
  return value;
}

function normalizeProviderLabel(label: string) {
  const value = label.trim();
  if (value.length < 2 || value.length > 80) {
    throw new Error("Provider names must be 2–80 characters.");
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

function adapterForConfig(
  providerId: string,
  config: Awaited<ReturnType<typeof providerConfig>>,
  overrides?: { label?: string; baseUrl?: string; defaultModelId?: string },
) {
  if (!config?.isCustom) return getAIProviderAdapter(providerId);
  return createOpenAICompatibleAdapter({
    id: providerId,
    label: normalizeProviderLabel(overrides?.label ?? config.label ?? ""),
    baseUrl: normalizeCompatibleBaseUrl(
      overrides?.baseUrl ?? config.baseUrl ?? "",
    ),
    defaultModelId:
      overrides?.defaultModelId ??
      config.defaultModelId ??
      config.customModelIds[0] ??
      "model",
  });
}

export async function providerExists(providerId: string) {
  if (isAIProviderId(providerId)) return true;
  return Boolean((await providerConfig(providerId))?.isCustom);
}

export async function getProviderApiKey(providerId: string) {
  const config = await providerConfig(providerId);
  if (config?.encryptedValue) return decryptProviderSecret(config.encryptedValue);
  if (config?.isCustom && config.baseUrl) return "";
  const environmentKey = environmentApiKey(providerId);
  if (environmentKey) return environmentKey;
  throw new Error(`${adapterForConfig(providerId, config).label} is not configured.`);
}

export async function getProviderStatus(
  providerId: string,
): Promise<AIProviderStatus> {
  const config = await providerConfig(providerId);
  const adapter = adapterForConfig(providerId, config);
  const environmentKey = config?.isCustom ? null : environmentApiKey(providerId);
  const siteKey = config?.encryptedValue
    ? decryptProviderSecret(config.encryptedValue)
    : null;
  const activeKey = siteKey ?? environmentKey;
  const customConfigured = Boolean(
    config?.isCustom && config.baseUrl && config.customModelIds.length > 0,
  );

  return {
    id: adapter.id,
    label: adapter.label,
    description: adapter.description,
    configured: customConfigured || Boolean(activeKey),
    enabled: config ? config.enabled : Boolean(activeKey),
    source: siteKey ? "SITE" : environmentKey ? "ENVIRONMENT" : "NONE",
    maskedKey: activeKey ? `••••••••${activeKey.slice(-4)}` : null,
    defaultModelId: config?.defaultModelId || adapter.defaultModelId,
    customModelIds: config?.customModelIds ?? [],
    custom: config?.isCustom ?? false,
    baseUrl: config?.baseUrl ?? null,
    updatedAt: config?.updatedAt.toISOString() ?? null,
    updatedBy: config?.updatedBy.email ?? null,
  };
}

export async function listProviderStatuses() {
  const customProviders = await prisma.aiProviderConfig.findMany({
    where: { isCustom: true },
    orderBy: { updatedAt: "desc" },
    select: { providerId: true },
  });
  return Promise.all([
    ...listAIProviderAdapters().map((provider) => getProviderStatus(provider.id)),
    ...customProviders.map((provider) => getProviderStatus(provider.providerId)),
  ]);
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
  const adapter = adapterForConfig(providerId, await providerConfig(providerId));
  const apiKey = await getProviderApiKey(providerId);
  const models = await discoverProviderModels(
    adapter,
    apiKey,
    options.forceRefresh,
  );
  return mergeCustomModels(models, status.customModelIds)
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
  overrides?: { label?: string; baseUrl?: string },
) {
  const config = await providerConfig(providerId);
  const adapter = adapterForConfig(providerId, config, overrides);
  const key = apiKey
    ? config?.isCustom
      ? normalizeCustomApiKey(apiKey)
      : normalizeApiKey(apiKey)
    : await getProviderApiKey(providerId);
  const models = await discoverProviderModels(adapter, key, true);
  const chatModels = mergeCustomModels(
    models.filter((model) => model.chatCapable),
    config?.customModelIds ?? [],
  );
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
  customModelIds?: string[];
  label?: string;
  baseUrl?: string;
  updatedById: string;
}) {
  const existing = await providerConfig(input.providerId);
  if (!isAIProviderId(input.providerId) && !existing?.isCustom) {
    throw new Error("Unsupported AI provider.");
  }
  const newKey = input.apiKey?.trim()
    ? existing?.isCustom
      ? normalizeCustomApiKey(input.apiKey)
      : normalizeApiKey(input.apiKey)
    : undefined;
  const availableKey: string | null =
    newKey ??
    (existing?.encryptedValue
      ? decryptProviderSecret(existing.encryptedValue)
      : existing?.isCustom
        ? ""
        : environmentApiKey(input.providerId));

  if (input.enabled && availableKey === null) {
    throw new Error("Add an API key before enabling this provider.");
  }

  let defaultModelId =
    input.defaultModelId?.trim() ||
    existing?.defaultModelId ||
    adapterForConfig(input.providerId, existing).defaultModelId;
  const customModelIds = normalizeCustomModelIds(
    input.customModelIds ?? existing?.customModelIds ?? [],
  );
  const label = existing?.isCustom
    ? normalizeProviderLabel(input.label ?? existing.label ?? "")
    : null;
  const baseUrl = existing?.isCustom
    ? normalizeCompatibleBaseUrl(input.baseUrl ?? existing.baseUrl ?? "")
    : null;

  if (
    availableKey !== null &&
    (existing?.isCustom ||
      newKey ||
      input.enabled ||
      input.defaultModelId ||
      input.customModelIds)
  ) {
    const adapter = adapterForConfig(input.providerId, existing, {
      label: label ?? undefined,
      baseUrl: baseUrl ?? undefined,
      defaultModelId,
    });
    const models = await discoverProviderModels(adapter, availableKey, true);
    const chatModels = mergeCustomModels(
      models.filter((model) => model.chatCapable),
      customModelIds,
    );
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
      customModelIds,
      updatedById: input.updatedById,
    },
    update: {
      encryptedValue: newKey ? encryptProviderSecret(newKey) : undefined,
      enabled: input.enabled,
      defaultModelId,
      customModelIds,
      label: label ?? undefined,
      baseUrl: baseUrl ?? undefined,
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
      customModelIds: [],
      updatedById,
    },
    update: { encryptedValue: null, enabled: false, updatedById },
  });
  clearProviderModelCache(providerId);
  return getProviderStatus(providerId);
}

export async function createCustomProvider(input: {
  label: string;
  baseUrl: string;
  apiKey?: string;
  modelIds: string[];
  updatedById: string;
}) {
  const label = normalizeProviderLabel(input.label);
  const baseUrl = normalizeCompatibleBaseUrl(input.baseUrl);
  const customModelIds = normalizeCustomModelIds(input.modelIds);
  if (customModelIds.length === 0) {
    throw new Error("Add at least one chat model ID.");
  }
  const apiKey = input.apiKey?.trim()
    ? normalizeCustomApiKey(input.apiKey)
    : "";
  const providerId = `custom-${randomUUID().slice(0, 12)}`;
  const adapter = createOpenAICompatibleAdapter({
    id: providerId,
    label,
    baseUrl,
    defaultModelId: customModelIds[0],
  });
  await adapter.listModels(apiKey);

  await prisma.aiProviderConfig.create({
    data: {
      providerId,
      encryptedValue: apiKey ? encryptProviderSecret(apiKey) : null,
      enabled: true,
      defaultModelId: customModelIds[0],
      customModelIds,
      isCustom: true,
      label,
      baseUrl,
      updatedById: input.updatedById,
    },
  });
  return getProviderStatus(providerId);
}

export async function deleteCustomProvider(providerId: string) {
  const config = await providerConfig(providerId);
  if (!config?.isCustom) throw new Error("Only custom providers can be deleted.");
  await prisma.$transaction([
    prisma.workspaceAiConfig.deleteMany({ where: { researchProviderId: providerId } }),
    prisma.workspaceAiConfig.updateMany({
      where: { humanizerProviderId: providerId },
      data: { humanizerProviderId: null, humanizerModelId: null },
    }),
    prisma.userAiSelection.deleteMany({ where: { providerId } }),
    prisma.agent.updateMany({
      where: { providerId },
      data: { providerId: null, modelId: null },
    }),
    prisma.aiProviderConfig.delete({ where: { providerId } }),
  ]);
  clearProviderModelCache(providerId);
}

export async function resolveProviderLanguageModel(
  providerId: string,
  modelId: string,
) {
  const config = await providerConfig(providerId);
  const adapter = adapterForConfig(providerId, config);
  const apiKey = await getProviderApiKey(providerId);
  return {
    providerId,
    modelId,
    providerLabel: adapter.label,
    model: adapter.createLanguageModel(apiKey, modelId),
  };
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
  agentId?: string,
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

  const agent = agentId
    ? await prisma.agent.findFirst({
        where: { id: agentId, userId },
        select: { providerId: true, modelId: true },
      })
    : null;
  if (agentId && !agent) throw new Error("Agent not found.");
  const stored = await prisma.userAiSelection.findUnique({ where: { userId } });
  let selection = stored
    ? { providerId: stored.providerId, modelId: stored.modelId }
    : null;
  if (agent?.providerId && agent.modelId) {
    selection = { providerId: agent.providerId, modelId: agent.modelId };
  }

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
      if (agentId) {
        await prisma.agent.update({
          where: { id: agentId },
          data: selection,
        });
      }
    } else {
      selection = null;
    }
  }

  return { providers, selection, canConfigure };
}

export async function saveUserAISelection(
  userId: string,
  selection: AISelection,
  agentId?: string,
) {
  if (!(await providerExists(selection.providerId))) {
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
  if (agentId) {
    const updated = await prisma.agent.updateMany({
      where: { id: agentId, userId },
      data: selection,
    });
    if (updated.count === 0) throw new Error("Agent not found.");
  } else {
    await prisma.userAiSelection.upsert({
      where: { userId },
      create: { userId, ...selection },
      update: selection,
    });
  }
  return selection;
}

export async function resolveUserLanguageModel(userId: string, agentId?: string) {
  const catalog = await getAIProviderCatalog(userId, false, agentId);
  if (!catalog.selection) {
    throw new Error(
      "No AI provider is available. An administrator must configure and enable one.",
    );
  }
  return resolveProviderLanguageModel(
    catalog.selection.providerId,
    catalog.selection.modelId,
  );
}
