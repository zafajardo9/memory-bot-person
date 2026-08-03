"use client";

import {
  ArrowRight,
  BrainCircuit,
  Check,
  DatabaseZap,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import type { AIProviderStatus } from "@/ai/providers/types";
import type {
  KnowledgeAISettings,
  KnowledgeEmbeddingSelection,
} from "@/lib/knowledge/embedding-settings";

export function KnowledgeAISettingsPanel({
  initialSettings,
  providerStatuses,
}: {
  initialSettings: KnowledgeAISettings;
  providerStatuses: AIProviderStatus[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [selection, setSelection] = useState(initialSettings.selection);
  const [saving, setSaving] = useState(false);

  const providers = useMemo(
    () =>
      settings.providers.map((provider) => {
        const liveStatus = providerStatuses.find(
          (status) => status.id === provider.id,
        );
        return {
          ...provider,
          configured: liveStatus?.configured ?? provider.configured,
          enabled: liveStatus?.enabled ?? provider.enabled,
        };
      }),
    [providerStatuses, settings.providers],
  );
  const activeProvider = providers.find(
    (provider) => provider.id === selection.providerId,
  );
  const activeModel = activeProvider?.models.find(
    (model) => model.id === selection.modelId,
  );
  const providerAvailable = Boolean(
    activeProvider?.configured && activeProvider.enabled,
  );
  const dirty =
    selection.providerId !== settings.selection.providerId ||
    selection.modelId !== settings.selection.modelId;

  const selectProvider = (providerId: KnowledgeEmbeddingSelection["providerId"]) => {
    const provider = providers.find((candidate) => candidate.id === providerId);
    setSelection({
      providerId,
      modelId: provider?.models[0]?.id ?? "",
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/ai/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to save knowledge settings.");
      }
      setSettings(result as KnowledgeAISettings);
      setSelection((result as KnowledgeAISettings).selection);
      toast.success("Knowledge processing model updated", {
        description: "Rescan existing sources to rebuild them with this model.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save knowledge settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="content-surface overflow-hidden rounded-3xl"
      aria-labelledby="knowledge-processing-heading"
    >
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_0.9fr] lg:p-7">
        <div>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BrainCircuit size={19} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="knowledge-processing-heading"
                  className="text-lg font-semibold tracking-[-0.02em]"
                >
                  Knowledge processing
                </h2>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-primary">
                  Workspace-wide
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Choose the embedding engine that turns extracted links, files,
                and notes into searchable knowledge for every agent.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1.5">Extract</span>
            <ArrowRight size={13} />
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
              Embed with AI
            </span>
            <ArrowRight size={13} />
            <span className="rounded-full bg-muted px-3 py-1.5">Retrieve</span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Provider
              <select
                value={selection.providerId}
                onChange={(event) =>
                  selectProvider(
                    event.target.value as KnowledgeEmbeddingSelection["providerId"],
                  )
                }
                className="h-11 rounded-xl border bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                    {!provider.configured || !provider.enabled
                      ? " — setup required"
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Embedding model
              <select
                value={selection.modelId}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    modelId: event.target.value,
                  }))
                }
                className="h-11 rounded-xl border bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              >
                {(activeProvider?.models ?? []).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-3 min-h-5 text-xs leading-5 text-muted-foreground">
            {activeModel?.description}
          </p>

          {!providerAvailable ? (
            <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-300">
              Connect and enable {activeProvider?.label ?? "this provider"} in
              the directory below before selecting it for knowledge processing.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving || !providerAvailable}
              className="rounded-full"
            >
              {saving ? (
                <RefreshCw className="animate-spin" size={14} />
              ) : (
                <Check size={14} />
              )}
              Save processing model
            </Button>
            {!dirty && settings.updatedBy ? (
              <span className="text-xs text-muted-foreground">
                Last changed by {settings.updatedBy}
              </span>
            ) : null}
          </div>
        </div>

        <aside className="rounded-2xl bg-primary/[0.055] p-5 ring-1 ring-inset ring-primary/10">
          <DatabaseZap className="text-primary" size={20} />
          <h3 className="mt-4 font-semibold">Changing models requires a rescan</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Embedding models create different vector spaces. Existing sources
            stay stored safely, but only sources scanned with the active model
            participate in semantic retrieval.
          </p>
          <Link
            href="/knowledge"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Open knowledge sources
            <ArrowRight size={14} />
          </Link>
        </aside>
      </div>
    </section>
  );
}
