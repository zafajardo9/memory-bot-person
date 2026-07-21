import type { LanguageModel } from "ai";

export interface AIProviderModel {
  id: string;
  label: string;
  description?: string;
  chatCapable: boolean;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

export interface AIProviderAdapter {
  id: string;
  label: string;
  description: string;
  environmentKey: string;
  defaultModelId: string;
  createLanguageModel: (apiKey: string, modelId: string) => LanguageModel;
  listModels: (apiKey: string) => Promise<AIProviderModel[]>;
}

export type AIProviderCredentialSource = "SITE" | "ENVIRONMENT" | "NONE";

export interface AIProviderStatus {
  id: string;
  label: string;
  description: string;
  configured: boolean;
  enabled: boolean;
  source: AIProviderCredentialSource;
  maskedKey: string | null;
  defaultModelId: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AIProviderCatalogEntry {
  id: string;
  label: string;
  description: string;
  defaultModelId: string;
  models: AIProviderModel[];
  modelDiscoveryError?: string;
}

export interface AISelection {
  providerId: string;
  modelId: string;
}

export interface AIProviderCatalog {
  providers: AIProviderCatalogEntry[];
  selection: AISelection | null;
  canConfigure: boolean;
}
