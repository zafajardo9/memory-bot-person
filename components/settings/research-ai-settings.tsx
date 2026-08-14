"use client";

import {
  ArrowRight,
  BrainCircuit,
  Check,
  CircleAlert,
  RefreshCw,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import type { WorkspaceAISettings } from "@/ai/providers/research-settings";
import type { AIProviderStatus, AISelection } from "@/ai/providers/types";

type Role = "thinking" | "humanizer";

function initialSelection(settings: WorkspaceAISettings, role: Role): AISelection {
  const saved = role === "thinking" ? settings.selection : settings.humanizerSelection;
  if (saved) return saved;
  const supportsRole = (
    model: WorkspaceAISettings["providers"][number]["models"][number],
  ) => role === "humanizer" || model.toolCallingCapable;
  const provider =
    settings.providers.find(
      (candidate) =>
        candidate.configured &&
        candidate.enabled &&
        candidate.models.some(supportsRole),
    ) ?? settings.providers.find((candidate) => candidate.models.some(supportsRole));
  return {
    providerId: provider?.id ?? "",
    modelId: provider?.models.find(supportsRole)?.id ?? "",
  };
}

export function ResearchAISettingsPanel({
  initialSettings,
  providerStatuses,
  onChange,
}: {
  initialSettings: WorkspaceAISettings;
  providerStatuses: AIProviderStatus[];
  onChange?: (settings: WorkspaceAISettings) => void;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [thinkingSelection, setThinkingSelection] = useState(() =>
    initialSelection(initialSettings, "thinking"),
  );
  const [humanizerSelection, setHumanizerSelection] = useState(() =>
    initialSelection(initialSettings, "humanizer"),
  );
  const [saving, setSaving] = useState(false);

  const providers = useMemo(
    () =>
      settings.providers.map((provider) => {
        const status = providerStatuses.find(
          (candidate) => candidate.id === provider.id,
        );
        return {
          ...provider,
          configured: status?.configured ?? provider.configured,
          enabled: status?.enabled ?? provider.enabled,
        };
      }),
    [providerStatuses, settings.providers],
  );
  const thinkingProvider = providers.find(
    (provider) => provider.id === thinkingSelection.providerId,
  );
  const thinkingModels = (thinkingProvider?.models ?? []).filter(
    (model) => model.toolCallingCapable,
  );
  const thinkingModel = thinkingModels.find(
    (model) => model.id === thinkingSelection.modelId,
  );
  const humanizerProvider = providers.find(
    (provider) => provider.id === humanizerSelection.providerId,
  );
  const humanizerModel = humanizerProvider?.models.find(
    (model) => model.id === humanizerSelection.modelId,
  );
  const thinkingReady = Boolean(
    thinkingProvider?.configured && thinkingProvider.enabled && thinkingModel,
  );
  const humanizerReady = Boolean(
    humanizerProvider?.configured && humanizerProvider.enabled && humanizerModel,
  );
  const dirty =
    thinkingSelection.providerId !== (settings.selection?.providerId ?? "") ||
    thinkingSelection.modelId !== (settings.selection?.modelId ?? "") ||
    humanizerSelection.providerId !==
      (settings.humanizerSelection?.providerId ?? "") ||
    humanizerSelection.modelId !== (settings.humanizerSelection?.modelId ?? "");

  const selectThinkingProvider = (providerId: string) => {
    const provider = providers.find((candidate) => candidate.id === providerId);
    setThinkingSelection({
      providerId,
      modelId:
        provider?.models.find((model) => model.toolCallingCapable)?.id ?? "",
    });
  };
  const selectHumanizerProvider = (providerId: string) => {
    const provider = providers.find((candidate) => candidate.id === providerId);
    setHumanizerSelection({
      providerId,
      modelId: provider?.models[0]?.id ?? "",
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/ai/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thinkingSelection, humanizerSelection }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to save workspace AI settings.");
      }
      const next = result as WorkspaceAISettings;
      setSettings(next);
      setThinkingSelection(initialSelection(next, "thinking"));
      setHumanizerSelection(initialSelection(next, "humanizer"));
      onChange?.(next);
      toast.success("Workspace AI flow updated", {
        description:
          "New chats will use the selected Thinking and Humanizer roles.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save workspace AI settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="overflow-hidden rounded-3xl border bg-background/75 shadow-sm"
      aria-labelledby="workspace-ai-flow-heading"
    >
      <header className="bg-primary p-5 text-primary-foreground sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Workflow size={19} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="workspace-ai-flow-heading"
                  className="text-lg font-semibold tracking-[-0.025em]"
                >
                  Answer pipeline
                </h3>
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.14em]">
                  Workspace-wide
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-primary-foreground/75">
                One model investigates with tools. A second model shapes the
                final response without direct tool access.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span
              className={`size-2 rounded-full ${
                thinkingReady && humanizerReady ? "bg-emerald-300" : "bg-amber-300"
              }`}
            />
            {thinkingReady && humanizerReady ? "Pipeline ready" : "Needs attention"}
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)]">
          <RoleCard
            icon={BrainCircuit}
            step="01"
            title="Thinking"
            description="Researches, calls tools, and gathers evidence."
            providerLabel="Thinking provider"
            modelLabel="Thinking model"
            providers={providers}
            selection={thinkingSelection}
            models={thinkingModels}
            onProviderChange={selectThinkingProvider}
            onModelChange={(modelId) =>
              setThinkingSelection((current) => ({ ...current, modelId }))
            }
            modelDescription={thinkingModel?.description}
            ready={thinkingReady}
            warningProvider={thinkingProvider?.label}
          />

          <div className="flex items-center justify-center" aria-hidden="true">
            <span className="flex size-8 rotate-90 items-center justify-center rounded-full border bg-muted text-muted-foreground lg:rotate-0">
              <ArrowRight size={14} />
            </span>
          </div>

          <RoleCard
            icon={Sparkles}
            step="02"
            title="Humanizer"
            description="Writes the clear, natural answer people see."
            providerLabel="Humanizer provider"
            modelLabel="End processor model"
            providers={providers}
            selection={humanizerSelection}
            models={humanizerProvider?.models ?? []}
            onProviderChange={selectHumanizerProvider}
            onModelChange={(modelId) =>
              setHumanizerSelection((current) => ({ ...current, modelId }))
            }
            modelDescription={humanizerModel?.description}
            ready={humanizerReady}
            warningProvider={humanizerProvider?.label}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center">
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving || !thinkingReady || !humanizerReady}
            className="rounded-xl"
          >
            {saving ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : (
              <Check size={14} />
            )}
            Save answer pipeline
          </Button>
          <p className="text-xs leading-5 text-muted-foreground sm:ml-auto sm:max-w-md sm:text-right">
            If Humanizer is turned off or unavailable, Thinking writes the final
            answer automatically.
            {!dirty && settings.updatedBy
              ? ` Last changed by ${settings.updatedBy}.`
              : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

function RoleCard({
  icon: Icon,
  step,
  title,
  description,
  providerLabel,
  modelLabel,
  providers,
  selection,
  models,
  onProviderChange,
  onModelChange,
  modelDescription,
  ready,
  warningProvider,
}: {
  icon: typeof BrainCircuit;
  step: string;
  title: string;
  description: string;
  providerLabel: string;
  modelLabel: string;
  providers: WorkspaceAISettings["providers"];
  selection: AISelection;
  models: WorkspaceAISettings["providers"][number]["models"];
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  modelDescription?: string;
  ready: boolean;
  warningProvider?: string;
}) {
  return (
    <fieldset className="min-w-0 rounded-2xl border bg-muted/25 p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold">{title}</h4>
            <span className="font-mono text-[10px] text-muted-foreground">{step}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid min-w-0 gap-2 text-xs font-medium">
          {providerLabel}
          <select
            value={selection.providerId}
            onChange={(event) => onProviderChange(event.target.value)}
            className="h-11 min-w-0 rounded-xl border bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          >
            <option value="" disabled>
              Select a provider
            </option>
            {providers.map((provider) => (
              <option
                key={provider.id}
                value={provider.id}
                disabled={!provider.models.length}
              >
                {provider.label}
                {!provider.configured || !provider.enabled
                  ? " — setup required"
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-2 text-xs font-medium">
          {modelLabel}
          <select
            value={selection.modelId}
            onChange={(event) => onModelChange(event.target.value)}
            disabled={!models.length}
            className="h-11 min-w-0 rounded-xl border bg-background px-3 font-mono text-xs outline-none transition-[border-color,box-shadow] focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 min-h-14 border-t pt-3">
        {ready ? (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {modelDescription ?? "Model is connected and ready."}
          </p>
        ) : (
          <p className="flex gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
            <CircleAlert className="mt-0.5 shrink-0" size={13} />
            Connect and enable {warningProvider ?? "this provider"} before using
            it for {title}.
          </p>
        )}
      </div>
    </fieldset>
  );
}
