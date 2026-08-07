import "server-only";

import {
  getProviderApiKey,
  getProviderStatus,
} from "@/ai/providers/service";
import { prisma } from "@/lib/prisma";

export interface KnowledgeEmbeddingModelOption {
  id: string;
  label: string;
  description: string;
  storageModelId: string;
}

export interface KnowledgeEmbeddingProviderOption {
  id: "google" | "openai" | "huggingface";
  label: string;
  configured: boolean;
  enabled: boolean;
  models: KnowledgeEmbeddingModelOption[];
}

export interface KnowledgeEmbeddingSelection {
  providerId: KnowledgeEmbeddingProviderOption["id"];
  modelId: string;
}

/** A resolved, ready-to-use embedding engine for one provider. */
export interface KnowledgeEmbeddingEngine {
  providerId: "google" | "openai" | "huggingface";
  modelId: string;
  providerLabel: string;
  storageModelId: string;
  apiKey: string;
}

export interface KnowledgeAISettings {
  selection: KnowledgeEmbeddingSelection;
  providers: KnowledgeEmbeddingProviderOption[];
  updatedAt: string | null;
  updatedBy: string | null;
}

const WORKSPACE_CONFIG_ID = "workspace";

const providerDefinitions: Array<
  Pick<KnowledgeEmbeddingProviderOption, "id" | "label" | "models">
> = [
  {
    id: "google",
    label: "Google Gemini",
    models: [
      {
        id: "gemini-embedding-2",
        label: "Gemini Embedding 2",
        description: "Current high-quality Google retrieval model.",
        // Preserve compatibility with knowledge indexed before this setting existed.
        storageModelId: "gemini-embedding-2",
      },
      {
        id: "gemini-embedding-001",
        label: "Gemini Embedding 001",
        description: "Stable Google embedding model for text retrieval.",
        storageModelId: "google:gemini-embedding-001",
      },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    models: [
      {
        id: "text-embedding-3-small",
        label: "Text Embedding 3 Small",
        description: "Faster, lower-cost indexing for most workspaces.",
        storageModelId: "openai:text-embedding-3-small",
      },
      {
        id: "text-embedding-3-large",
        label: "Text Embedding 3 Large",
        description: "Higher-capability retrieval with a higher indexing cost.",
        storageModelId: "openai:text-embedding-3-large",
      },
    ],
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    models: [
      {
        id: "sentence-transformers/multi-qa-mpnet-base-dot-v1",
        label: "Multi-QA MPNet (768d)",
        description:
          "Trained on 215M question-answer pairs for semantic search — ideal for company knowledge retrieval.",
        storageModelId:
          "huggingface:sentence-transformers/multi-qa-mpnet-base-dot-v1",
      },
      {
        id: "sentence-transformers/all-mpnet-base-v2",
        label: "All MPNet Base v2 (768d)",
        description: "General-purpose sentence embeddings with strong all-around quality.",
        storageModelId: "huggingface:sentence-transformers/all-mpnet-base-v2",
      },
    ],
  },
];

export const DEFAULT_KNOWLEDGE_EMBEDDING_SELECTION = {
  providerId: "google",
  modelId: "gemini-embedding-2",
} satisfies KnowledgeEmbeddingSelection;

function definitionFor(selection: KnowledgeEmbeddingSelection) {
  const provider = providerDefinitions.find(
    (candidate) => candidate.id === selection.providerId,
  );
  const model = provider?.models.find(
    (candidate) => candidate.id === selection.modelId,
  );
  if (!provider || !model) {
    throw new Error("Unsupported knowledge embedding model.");
  }
  return { provider, model };
}

async function storedConfig() {
  return prisma.knowledgeAiConfig.findUnique({
    where: { id: WORKSPACE_CONFIG_ID },
    include: { updatedBy: { select: { email: true } } },
  });
}

export async function getKnowledgeAISettings(): Promise<KnowledgeAISettings> {
  const [config, ...statuses] = await Promise.all([
    storedConfig(),
    ...providerDefinitions.map((provider) => getProviderStatus(provider.id)),
  ]);
  const selection = config
    ? { providerId: config.providerId, modelId: config.modelId }
    : DEFAULT_KNOWLEDGE_EMBEDDING_SELECTION;

  // Invalid legacy/manual values fall back visibly without mutating the database.
  let resolvedSelection = selection as KnowledgeEmbeddingSelection;
  try {
    definitionFor(resolvedSelection);
  } catch {
    resolvedSelection = DEFAULT_KNOWLEDGE_EMBEDDING_SELECTION;
  }

  return {
    selection: resolvedSelection,
    providers: providerDefinitions.map((provider, index) => ({
      ...provider,
      configured: statuses[index].configured,
      enabled: statuses[index].enabled,
    })),
    updatedAt: config?.updatedAt.toISOString() ?? null,
    updatedBy: config?.updatedBy.email ?? null,
  };
}

export async function saveKnowledgeAISelection(
  selection: KnowledgeEmbeddingSelection,
  updatedById: string,
) {
  definitionFor(selection);
  const status = await getProviderStatus(selection.providerId);
  if (!status.configured || !status.enabled) {
    throw new Error(`${status.label} must be connected and enabled first.`);
  }

  await prisma.knowledgeAiConfig.upsert({
    where: { id: WORKSPACE_CONFIG_ID },
    create: { id: WORKSPACE_CONFIG_ID, ...selection, updatedById },
    update: { ...selection, updatedById },
  });
  return getKnowledgeAISettings();
}

export async function resolveKnowledgeEmbeddingEngine() {
  const config = await storedConfig();
  const selection = config
    ? ({
        providerId: config.providerId,
        modelId: config.modelId,
      } as KnowledgeEmbeddingSelection)
    : DEFAULT_KNOWLEDGE_EMBEDDING_SELECTION;
  const { provider, model } = definitionFor(selection);

  if (config) {
    const status = await getProviderStatus(provider.id);
    if (!status.configured || !status.enabled) {
      throw new Error(
        `${status.label} is selected for knowledge processing but is not enabled. Update Knowledge processing in AI settings.`,
      );
    }
  }

  return {
    ...selection,
    providerLabel: provider.label,
    storageModelId: model.storageModelId,
    apiKey: await getProviderApiKey(provider.id),
  };
}

/**
 * Resolves the active embedding engine plus every other connected and enabled
 * embedding provider, so knowledge processing can fail over automatically when
 * the active provider is rate-limited or unavailable.
 */
export async function resolveKnowledgeEmbeddingEngines(): Promise<
  KnowledgeEmbeddingEngine[]
> {
  const active = await resolveKnowledgeEmbeddingEngine();
  const settings = await getKnowledgeAISettings();
  const alternates: KnowledgeEmbeddingEngine[] = [];

  for (const provider of settings.providers) {
    if (provider.id === active.providerId) continue;
    if (!provider.configured || !provider.enabled) continue;
    const model = provider.models[0];
    if (!model) continue;
    try {
      alternates.push({
        providerId: provider.id,
        modelId: model.id,
        providerLabel: provider.label,
        storageModelId: model.storageModelId,
        apiKey: await getProviderApiKey(provider.id),
      });
    } catch {
      // Skip providers whose key cannot be resolved at this moment.
    }
  }

  return [active, ...alternates];
}
