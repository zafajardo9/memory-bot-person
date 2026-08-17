import "server-only";

import { prisma } from "@/lib/prisma";

import {
  getProviderModels,
  getProviderStatus,
  listProviderStatuses,
  resolveProviderLanguageModel,
  resolveUserLanguageModel,
} from "./service";

import type { AIProviderModel, AISelection } from "./types";

const WORKSPACE_CONFIG_ID = "workspace";

export interface ResearchProviderOption {
  id: string;
  label: string;
  description: string;
  configured: boolean;
  enabled: boolean;
  models: AIProviderModel[];
  modelDiscoveryError?: string;
}

export interface WorkspaceAISettings {
  selection: AISelection | null;
  humanizerSelection: AISelection | null;
  providers: ResearchProviderOption[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface WorkspaceAIRuntimeStatus {
  available: boolean;
  thinkingProviderLabel: string | null;
  humanizerAvailable: boolean;
}

async function storedConfig() {
  return prisma.workspaceAiConfig.findUnique({
    where: { id: WORKSPACE_CONFIG_ID },
    include: { updatedBy: { select: { email: true } } },
  });
}

async function researchProviderOptions(): Promise<ResearchProviderOption[]> {
  const statuses = await listProviderStatuses();
  return Promise.all(
    statuses.map(async (status) => {
      if (!status.configured) return { ...status, models: [] };
      try {
        const models = await getProviderModels(status.id);
        return { ...status, models };
      } catch (error) {
        return {
          ...status,
          models: [],
          modelDiscoveryError:
            error instanceof Error ? error.message : "Model discovery failed.",
        };
      }
    }),
  );
}

export async function getWorkspaceAISettings(): Promise<WorkspaceAISettings> {
  const [config, providers] = await Promise.all([
    storedConfig(),
    researchProviderOptions(),
  ]);
  const selection = config
    ? {
        providerId: config.researchProviderId,
        modelId: config.researchModelId,
      }
    : null;
  const validSelection = Boolean(
    selection &&
      providers
        .find((provider) => provider.id === selection.providerId)
        ?.models.some(
          (model) => model.id === selection.modelId && model.toolCallingCapable,
        ),
  );
  const humanizerSelection =
    config?.humanizerProviderId && config.humanizerModelId
      ? {
          providerId: config.humanizerProviderId,
          modelId: config.humanizerModelId,
        }
      : null;
  const validHumanizerSelection = Boolean(
    humanizerSelection &&
      providers
        .find((provider) => provider.id === humanizerSelection.providerId)
        ?.models.some((model) => model.id === humanizerSelection.modelId),
  );

  return {
    selection: validSelection ? selection : null,
    humanizerSelection: validHumanizerSelection ? humanizerSelection : null,
    providers,
    updatedAt: config?.updatedAt.toISOString() ?? null,
    updatedBy: config?.updatedBy.email ?? null,
  };
}

async function validateSelection(
  selection: AISelection,
  capability: "thinking" | "humanizer",
) {
  const status = await getProviderStatus(selection.providerId);
  if (!status.configured || !status.enabled) {
    throw new Error(`${status.label} must be connected and enabled first.`);
  }
  const model = (await getProviderModels(selection.providerId, {
    requireEnabled: true,
  })).find((candidate) => candidate.id === selection.modelId);
  if (!model) {
    throw new Error("The selected model is not accessible to this provider key.");
  }
  if (capability === "thinking" && !model.toolCallingCapable) {
    throw new Error("The selected thinking model does not support tool calling.");
  }
  return model;
}

export async function saveWorkspaceAISelections(
  input: {
    thinkingSelection: AISelection;
    humanizerSelection: AISelection | null;
  },
  updatedById: string,
) {
  await validateSelection(input.thinkingSelection, "thinking");
  if (input.humanizerSelection) {
    await validateSelection(input.humanizerSelection, "humanizer");
  }

  await prisma.workspaceAiConfig.upsert({
    where: { id: WORKSPACE_CONFIG_ID },
    create: {
      id: WORKSPACE_CONFIG_ID,
      researchProviderId: input.thinkingSelection.providerId,
      researchModelId: input.thinkingSelection.modelId,
      humanizerProviderId: input.humanizerSelection?.providerId ?? null,
      humanizerModelId: input.humanizerSelection?.modelId ?? null,
      updatedById,
    },
    update: {
      researchProviderId: input.thinkingSelection.providerId,
      researchModelId: input.thinkingSelection.modelId,
      humanizerProviderId: input.humanizerSelection?.providerId ?? null,
      humanizerModelId: input.humanizerSelection?.modelId ?? null,
      updatedById,
    },
  });
  return getWorkspaceAISettings();
}

export async function saveWorkspaceResearchSelection(
  selection: AISelection,
  updatedById: string,
) {
  const current = await storedConfig();
  return saveWorkspaceAISelections(
    {
      thinkingSelection: selection,
      humanizerSelection:
        current?.humanizerProviderId && current.humanizerModelId
          ? {
              providerId: current.humanizerProviderId,
              modelId: current.humanizerModelId,
            }
          : null,
    },
    updatedById,
  );
}

export async function resolveWorkspaceHumanizerModel() {
  const config = await storedConfig();
  if (!config?.humanizerProviderId || !config.humanizerModelId) return null;

  try {
    const status = await getProviderStatus(config.humanizerProviderId);
    if (!status.configured || !status.enabled) return null;
    const model = (await getProviderModels(config.humanizerProviderId, {
      requireEnabled: true,
    })).find((candidate) => candidate.id === config.humanizerModelId);
    if (!model?.chatCapable) return null;
    return await resolveProviderLanguageModel(
      config.humanizerProviderId,
      config.humanizerModelId,
    );
  } catch (error) {
    console.error("Workspace humanizer model resolution failed", error);
    return null;
  }
}

export async function getWorkspaceAIRuntimeStatus(
  userId: string,
  agentId: string,
): Promise<WorkspaceAIRuntimeStatus> {
  const workspaceThinking = await resolveWorkspaceResearchModel();
  let thinking = workspaceThinking;
  if (!thinking) {
    try {
      thinking = await resolveUserLanguageModel(userId, agentId);
    } catch {
      thinking = null;
    }
  }
  const humanizer = thinking ? await resolveWorkspaceHumanizerModel() : null;
  return {
    available: Boolean(thinking),
    thinkingProviderLabel: thinking?.providerLabel ?? null,
    humanizerAvailable: Boolean(humanizer ?? thinking),
  };
}

export async function resolveWorkspaceResearchModel() {
  const config = await storedConfig();
  if (process.env.AI_RESEARCH_MODEL_ENABLED === "false") return null;
  // The research role is explicit: without a saved workspace selection there
  // is no dedicated research model, and chat falls back to the user's model
  // (single-pass flow). A silent default here would force every chat turn
  // through the two-phase research pipeline even when nothing was configured.
  if (!config) return null;

  try {
    const status = await getProviderStatus(config.researchProviderId);
    if (!status.configured || !status.enabled) return null;
    const model = (await getProviderModels(config.researchProviderId, {
      requireEnabled: true,
    })).find((candidate) => candidate.id === config.researchModelId);
    if (!model?.toolCallingCapable) return null;
    return await resolveProviderLanguageModel(
      config.researchProviderId,
      config.researchModelId,
    );
  } catch (error) {
    console.error("Workspace research model resolution failed", error);
    return null;
  }
}
