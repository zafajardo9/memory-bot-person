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
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
}: {
  provider: AIProviderStatus;
  onChange: (provider: AIProviderStatus) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(provider.enabled);
  const [defaultModelId, setDefaultModelId] = useState(provider.defaultModelId);
  const [models, setModels] = useState<AIProviderModel[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadingModels, setLoadingModels] = useState(provider.configured);

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
      });
      setModels(result.models);
      if (
        !result.models.some(
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
      });
      setEnabled(result.provider.enabled);
      setDefaultModelId(result.provider.defaultModelId);
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
    if (!window.confirm(`Remove the site-managed ${provider.label} key?`)) return;
    setPending(true);
    try {
      const result = await providerRequest(provider.id, "DELETE");
      setEnabled(result.provider.enabled);
      setDefaultModelId(result.provider.defaultModelId);
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

  return (
    <article
      className={`content-surface overflow-hidden rounded-3xl transition-[background-color,border-color] ${
        expanded ? "border-primary/25 bg-white/90 dark:bg-white/[0.065]" : "hover:border-foreground/15"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={`${provider.id}-configuration`}
        className="group flex w-full items-center gap-4 p-4 text-left sm:p-5"
      >
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl border font-mono text-sm font-semibold uppercase ${
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
              {provider.label}
            </span>
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
          <span className="mt-1 block truncate text-sm text-muted-foreground sm:whitespace-normal">
            {provider.description}
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-6 text-right sm:flex">
          {provider.configured ? (
            <span>
              <span className="block text-xs text-muted-foreground">Default model</span>
              <span className="mt-1 block max-w-44 truncate font-mono text-xs">
                {defaultModelId}
              </span>
            </span>
          ) : (
            <span className="text-xs font-medium text-primary">Set up provider</span>
          )}
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
          <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2 lg:p-6">
            <section aria-labelledby={`${provider.id}-credentials-heading`}>
              <div className="mb-4 flex items-center gap-2">
                <KeyRound className="text-primary" size={15} />
                <h3 id={`${provider.id}-credentials-heading`} className="text-sm font-semibold">
                  Credentials
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${provider.id}-key`}>
                    {provider.source === "SITE" ? "Replace API key" : "API key"}
                  </Label>
                  {provider.configured ? (
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

            <section aria-labelledby={`${provider.id}-model-heading`}>
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
                  disabled={models.length === 0}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {models.length === 0 ? (
                    <option value={defaultModelId}>
                      {loadingModels
                        ? "Loading accessible models…"
                        : "Test a key to load models"}
                    </option>
                  ) : (
                    models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs leading-5 text-muted-foreground">
                  {models.length > 0
                    ? `${models.length} chat ${models.length === 1 ? "model" : "models"} available with this connection.`
                    : "Models are discovered from the provider, so this list stays current."}
                </p>
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
            {provider.source === "SITE" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={removeKey}
                disabled={pending}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 size={14} />
                Remove key
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
