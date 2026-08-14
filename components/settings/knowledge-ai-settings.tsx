"use client";

import {
  ArrowRight,
  BrainCircuit,
  Check,
  CircleAlert,
  DatabaseZap,
  FileSearch,
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

  const selectProvider = (
    providerId: KnowledgeEmbeddingSelection["providerId"],
  ) => {
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
      className="overflow-hidden rounded-3xl border bg-background/75 shadow-sm"
      aria-labelledby="knowledge-processing-heading"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DatabaseZap size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="knowledge-processing-heading"
                    className="text-lg font-semibold tracking-[-0.025em]"
                  >
                    Knowledge index
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Workspace-wide
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                    providerAvailable
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      providerAvailable ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {providerAvailable ? "Index ready" : "Needs attention"}
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Converts links, files, and notes into searchable context that
                Thinking can retrieve during research.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid min-w-0 gap-2 text-xs font-medium">
              Embedding provider
              <select
                value={selection.providerId}
                onChange={(event) =>
                  selectProvider(
                    event.target.value as KnowledgeEmbeddingSelection["providerId"],
                  )
                }
                className="h-11 min-w-0 rounded-xl border bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
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

            <label className="grid min-w-0 gap-2 text-xs font-medium">
              Embedding model
              <select
                value={selection.modelId}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    modelId: event.target.value,
                  }))
                }
                className="h-11 min-w-0 rounded-xl border bg-background px-3 font-mono text-xs outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              >
                {(activeProvider?.models ?? []).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 min-h-12">
            {providerAvailable ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {activeModel?.description ?? "Embedding model is ready."}
              </p>
            ) : (
              <p className="flex gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
                <CircleAlert className="mt-0.5 shrink-0" size={13} />
                Connect and enable {activeProvider?.label ?? "this provider"}
                before assigning it to the knowledge index.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving || !providerAvailable}
              className="rounded-xl"
            >
              {saving ? (
                <RefreshCw className="animate-spin" size={14} />
              ) : (
                <Check size={14} />
              )}
              Save knowledge index
            </Button>
            {!dirty && settings.updatedBy ? (
              <span className="text-xs text-muted-foreground sm:ml-auto">
                Last changed by {settings.updatedBy}
              </span>
            ) : null}
          </div>
        </div>

        <aside className="border-t bg-muted/35 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <BrainCircuit size={14} />
            Retrieval lifecycle
          </div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center">
            <LifecycleStep icon={FileSearch} label="Extract" />
            <ArrowRight className="text-muted-foreground" size={13} />
            <LifecycleStep icon={DatabaseZap} label="Embed" active />
            <ArrowRight className="text-muted-foreground" size={13} />
            <LifecycleStep icon={BrainCircuit} label="Retrieve" />
          </div>
          <div className="mt-6 rounded-2xl border bg-background/70 p-4">
            <p className="text-sm font-semibold">Model changes need a rescan</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Different embedding models create different vector spaces. Your
              sources remain stored, but must be processed again for retrieval.
            </p>
            <Link
              href="/knowledge"
              className="mt-4 inline-flex items-center gap-2 rounded-md text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
            >
              Open knowledge sources
              <ArrowRight size={13} />
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

function LifecycleStep({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof FileSearch;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span
        className={`mx-auto flex size-9 items-center justify-center rounded-xl ${
          active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground shadow-sm"
        }`}
      >
        <Icon size={15} />
      </span>
      <span className="mt-2 block truncate text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
