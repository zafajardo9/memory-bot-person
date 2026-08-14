"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  mergeCustomModels,
  normalizeCustomModelId,
} from "@/ai/providers/custom-models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AIProviderModel, AIProviderStatus } from "@/ai/providers/types";

async function providerRequest(
  providerId: string,
  method: string,
  body?: object,
) {
  const response = await fetch(`/api/ai/providers/${providerId}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Provider request failed");
  return result;
}

async function fetchModels(providerId: string, refresh = false) {
  const suffix = refresh ? "?refresh=true" : "";
  const response = await fetch(`/api/ai/providers/${providerId}/models${suffix}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to load models");
  return result.models as AIProviderModel[];
}

export function ProviderSettingsCard({
  provider,
  onChange,
  onDelete,
}: {
  provider: AIProviderStatus;
  onChange: (provider: AIProviderStatus) => void;
  onDelete: (providerId: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(provider.enabled);
  const [defaultModelId, setDefaultModelId] = useState(provider.defaultModelId);
  const [customModelId, setCustomModelId] = useState("");
  const [customModelIds, setCustomModelIds] = useState(provider.customModelIds);
  const [providerLabel, setProviderLabel] = useState(provider.label);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [models, setModels] = useState<AIProviderModel[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadingModels, setLoadingModels] = useState(provider.configured);
  const availableModels = useMemo(
    () => mergeCustomModels(models.filter((model) => !model.custom), customModelIds),
    [customModelIds, models],
  );

  useEffect(() => {
    if (!provider.configured) return;
    let active = true;
    fetchModels(provider.id)
      .then((nextModels) => {
        if (active) setModels(nextModels);
      })
      .catch((error) => {
        if (active) toast.error(error.message);
      })
      .finally(() => {
        if (active) setLoadingModels(false);
      });
    return () => {
      active = false;
    };
  }, [provider.configured, provider.id]);

  const testConnection = async () => {
    setPending(true);
    try {
      const result = await providerRequest(provider.id, "POST", {
        apiKey: apiKey.trim() || undefined,
        label: provider.custom ? providerLabel : undefined,
        baseUrl: provider.custom ? baseUrl : undefined,
      });
      setModels(result.models);
      if (
        !mergeCustomModels(result.models, customModelIds).some(
          (model: AIProviderModel) => model.id === defaultModelId,
        )
      ) {
        setDefaultModelId(result.models[0]?.id ?? provider.defaultModelId);
      }
      toast.success(
        `${provider.label} connected. ${result.modelCount} chat models found.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Connection test failed",
      );
    } finally {
      setPending(false);
    }
  };

  const save = async () => {
    setPending(true);
    try {
      const result = await providerRequest(provider.id, "PUT", {
        apiKey: apiKey.trim() || undefined,
        enabled,
        defaultModelId,
        customModelIds,
        label: provider.custom ? providerLabel : undefined,
        baseUrl: provider.custom ? baseUrl : undefined,
      });
      setEnabled(result.provider.enabled);
      setDefaultModelId(result.provider.defaultModelId);
      setCustomModelIds(result.provider.customModelIds);
      setProviderLabel(result.provider.label);
      setBaseUrl(result.provider.baseUrl ?? "");
      onChange(result.provider);
      setApiKey("");
      toast.success(`${provider.label} settings saved.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save provider",
      );
    } finally {
      setPending(false);
    }
  };

  const refreshModels = async () => {
    setLoadingModels(true);
    try {
      const nextModels = await fetchModels(provider.id, true);
      setModels(nextModels);
      toast.success(`${nextModels.length} chat models refreshed.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to refresh models",
      );
    } finally {
      setLoadingModels(false);
    }
  };

  const removeKey = async () => {
    const prompt = provider.custom
      ? `Delete ${provider.label}? Team selections using it will be cleared.`
      : `Remove the site-managed ${provider.label} key?`;
    if (!window.confirm(prompt)) return;
    setPending(true);
    try {
      const result = await providerRequest(provider.id, "DELETE");
      if (result.deleted) {
        onDelete(provider.id);
        toast.success(`${provider.label} deleted.`);
        return;
      }
      setEnabled(result.provider.enabled);
      setDefaultModelId(result.provider.defaultModelId);
      setCustomModelIds(result.provider.customModelIds);
      onChange(result.provider);
      setModels([]);
      toast.success(
        result.provider.configured
          ? "Site key removed. The environment credential is available but disabled."
          : `${provider.label} key removed.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove key",
      );
    } finally {
      setPending(false);
    }
  };

  const canSave = Boolean(apiKey.trim() || provider.configured);
  const isActive = provider.configured && provider.enabled;

  const addCustomModel = () => {
    try {
      const modelId = normalizeCustomModelId(customModelId);
      if (
        customModelIds.includes(modelId) ||
        models.some((model) => model.id === modelId)
      ) {
        toast.error("That model is already in this provider's catalog.");
        return;
      }
      setCustomModelIds((current) => [...current, modelId]);
      setDefaultModelId(modelId);
      setCustomModelId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid model ID");
    }
  };

  const removeCustomModel = (modelId: string) => {
    const nextCustomModelIds = customModelIds.filter((id) => id !== modelId);
    setCustomModelIds(nextCustomModelIds);
    if (defaultModelId === modelId) {
      const nextModels = mergeCustomModels(
        models.filter((model) => !model.custom),
        nextCustomModelIds,
      );
      setDefaultModelId(nextModels[0]?.id ?? provider.defaultModelId);
    }
  };

  return (
    <article
      className={`content-surface overflow-hidden rounded-2xl transition-[background-color,border-color,box-shadow] motion-reduce:transition-none ${
        expanded
          ? "border-primary/25 bg-white/90 shadow-md md:col-span-2 dark:bg-white/[0.065]"
          : "hover:border-foreground/15 hover:shadow-sm"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={`${provider.id}-configuration`}
        className="group flex min-h-40 w-full items-start gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5"
      >
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl border font-mono text-xs font-semibold uppercase ${
            isActive
              ? "border-primary/20 bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}
          aria-hidden="true"
        >
          {provider.label.slice(0, 2)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tracking-[-0.01em]">
              {providerLabel}
            </span>
            {provider.custom ? (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-400">
                Custom
              </span>
            ) : null}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : provider.configured
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isActive ? (
                <Check size={11} />
              ) : (
                <CircleDashed size={11} />
              )}
              {isActive ? "Active" : provider.configured ? "Paused" : "Not connected"}
            </span>
          </span>
          <span className="mt-2 block line-clamp-2 text-sm leading-5 text-muted-foreground">
            {provider.description}
          </span>
          <span className="mt-4 flex min-w-0 items-center gap-2 border-t pt-3 text-xs">
            <span className="shrink-0 text-muted-foreground">
              {provider.configured ? "Default" : "Connection"}
            </span>
            <span className={`truncate ${provider.configured ? "font-mono" : "font-medium text-primary"}`}>
              {provider.configured ? defaultModelId : "Set up provider"}
            </span>
          </span>
        </span>

        <ChevronDown
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
            expanded ? "rotate-180" : "group-hover:translate-y-0.5"
          }`}
          size={18}
        />
      </button>

      {expanded ? (
        <div id={`${provider.id}-configuration`} className="border-t bg-muted/20">
          <div className="grid grid-cols-1 gap-6 p-4 sm:p-5 lg:grid-cols-2 lg:p-6">
            <section aria-labelledby={`${provider.id}-credentials-heading`} className="min-w-0">
              <div className="mb-4 flex items-center gap-2">
                <KeyRound className="text-primary" size={15} />
                <h3 id={`${provider.id}-credentials-heading`} className="text-sm font-semibold">
                  Credentials
                </h3>
              </div>

              <div className="space-y-2">
                {provider.custom ? (
                  <div className="mb-4 grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${provider.id}-label`}>Provider name</Label>
                      <Input
                        id={`${provider.id}-label`}
                        value={providerLabel}
                        onChange={(event) => setProviderLabel(event.target.value)}
                        maxLength={80}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${provider.id}-base-url`}>Base URL</Label>
                      <Input
                        id={`${provider.id}-base-url`}
                        type="url"
                        value={baseUrl}
                        onChange={(event) => setBaseUrl(event.target.value)}
                        maxLength={500}
                        className="bg-background font-mono"
                      />
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${provider.id}-key`}>
                    {provider.source === "SITE" ? "Replace API key" : "API key"}
                  </Label>
                  {provider.custom && provider.source === "NONE" ? (
                    <span className="text-[11px] text-muted-foreground">
                      Optional for local models
                    </span>
                  ) : provider.configured ? (
                    <span className="text-[11px] text-muted-foreground">
                      {provider.source === "SITE" ? "Site-managed" : "From environment"}
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <Input
                    id={`${provider.id}-key`}
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={provider.maskedKey ?? "Paste a provider API key"}
                    autoComplete="off"
                    className="bg-background pr-11 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Test the connection to discover every chat model available to this key.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={testConnection}
                  disabled={pending || (!apiKey.trim() && !provider.configured)}
                  className="gap-2 bg-background"
                >
                  {pending ? (
                    <LoaderCircle className="animate-spin" size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  Test connection
                </Button>
              </div>
            </section>

            <section aria-labelledby={`${provider.id}-model-heading`} className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 id={`${provider.id}-model-heading`} className="text-sm font-semibold">
                  Model availability
                </h3>
                {provider.configured ? (
                  <button
                    type="button"
                    onClick={refreshModels}
                    disabled={loadingModels}
                    className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-primary disabled:opacity-50"
                  >
                    <RefreshCw
                      className={loadingModels ? "animate-spin" : ""}
                      size={12}
                    />
                    Refresh models
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${provider.id}-model`}>Default model</Label>
                <select
                  id={`${provider.id}-model`}
                  value={defaultModelId}
                  onChange={(event) => setDefaultModelId(event.target.value)}
                  disabled={availableModels.length === 0}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {availableModels.length === 0 ? (
                    <option value={defaultModelId}>
                      {loadingModels
                        ? "Loading accessible models…"
                        : "Test a key to load models"}
                    </option>
                  ) : (
                    availableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}{model.custom ? " · Custom" : ""}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs leading-5 text-muted-foreground">
                  {availableModels.length > 0
                    ? `${availableModels.length} chat ${availableModels.length === 1 ? "model" : "models"} available with this connection.`
                    : "Models are discovered from the provider, so this list stays current."}
                </p>
              </div>

              <div className="mt-5 border-t pt-4">
                <Label htmlFor={`${provider.id}-custom-model`}>Add a model ID</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id={`${provider.id}-custom-model`}
                    value={customModelId}
                    onChange={(event) => setCustomModelId(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomModel();
                      }
                    }}
                    placeholder="provider-model-id"
                    className="bg-background font-mono"
                    maxLength={200}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addCustomModel}
                    disabled={!customModelId.trim()}
                    className="h-10 shrink-0 gap-1.5 bg-background"
                  >
                    <Plus size={14} />
                    Add
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Use an exact model ID when discovery has not listed a model yet.
                  Custom IDs are accepted as entered and may fail if your key lacks access.
                </p>

                {customModelIds.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Custom models">
                    {customModelIds.map((modelId) => (
                      <span
                        key={modelId}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 py-1 pl-2.5 pr-1.5 font-mono text-xs text-foreground"
                      >
                        <span className="truncate">{modelId}</span>
                        <button
                          type="button"
                          onClick={() => removeCustomModel(modelId)}
                          className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Remove custom model ${modelId}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-foreground/20">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  disabled={!canSave}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">Available in chat</span>
                  <span className="block text-xs leading-5 text-muted-foreground">
                    Team members can use this provider and its accessible models.
                  </span>
                </span>
              </label>
            </section>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t bg-card px-4 py-3 sm:px-5 lg:px-6">
            <Button type="button" onClick={save} disabled={pending || !canSave}>
              Save changes
            </Button>
            {provider.custom || provider.source === "SITE" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={removeKey}
                disabled={pending}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 size={14} />
                {provider.custom ? "Delete provider" : "Remove key"}
              </Button>
            ) : null}
            <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
              Changes apply to the whole workspace
            </span>
          </div>
        </div>
      ) : null}
    </article>
  );
}
