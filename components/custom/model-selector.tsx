"use client";

import { Bot, LoaderCircle, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetcher } from "@/lib/utils";

import type { AIProviderCatalog, AISelection } from "@/ai/providers/types";

export function ModelSelector({
  onAvailabilityChange,
}: {
  onAvailabilityChange: (available: boolean) => void;
}) {
  const { data, isLoading, mutate } = useSWR<AIProviderCatalog>(
    "/api/ai/selection",
    fetcher,
    { revalidateOnFocus: false },
  );
  const [saving, setSaving] = useState(false);

  const available = Boolean(data?.selection);
  useEffect(() => onAvailabilityChange(available), [available, onAvailabilityChange]);

  const saveSelection = async (selection: AISelection) => {
    setSaving(true);
    try {
      const response = await fetch("/api/ai/selection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to change model");
      await mutate((current) =>
        current ? { ...current, selection: result.selection } : current,
      false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to change model");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex h-8 items-center gap-2 px-1.5 text-xs text-muted-foreground">
        <LoaderCircle className="animate-spin" size={13} />
        Loading AI models…
      </div>
    );
  }

  if (!data.selection) {
    return (
      <div className="flex min-h-8 items-center justify-between gap-2 px-1.5 text-xs">
        <span className="text-muted-foreground">No AI provider is available.</span>
        {data.canConfigure ? (
          <Link href="/settings/ai" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
            <Settings2 size={13} /> Configure providers
          </Link>
        ) : (
          <span className="text-muted-foreground">Ask an administrator to connect one.</span>
        )}
      </div>
    );
  }

  const activeProvider = data.providers.find(
    (provider) => provider.id === data.selection?.providerId,
  );

  return (
    <div className="flex min-h-8 min-w-0 items-center gap-1.5 px-1.5">
      <Bot size={13} className="shrink-0 text-primary" aria-hidden="true" />
      <label className="sr-only" htmlFor="chat-provider">AI provider</label>
      <select
        id="chat-provider"
        value={data.selection.providerId}
        disabled={saving}
        onChange={(event) => {
          const provider = data.providers.find(
            (candidate) => candidate.id === event.target.value,
          );
          const model =
            provider?.models.find(
              (candidate) => candidate.id === provider.defaultModelId,
            ) ?? provider?.models[0];
          if (provider && model) {
            void saveSelection({ providerId: provider.id, modelId: model.id });
          }
        }}
        className="min-w-0 max-w-28 bg-transparent text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-36"
      >
        {data.providers.map((provider) => (
          <option key={provider.id} value={provider.id}>{provider.label}</option>
        ))}
      </select>
      <span className="hidden text-border sm:inline" aria-hidden="true">/</span>
      <label className="sr-only" htmlFor="chat-model">AI model</label>
      <select
        id="chat-model"
        value={data.selection.modelId}
        disabled={saving}
        onChange={(event) =>
          void saveSelection({
            providerId: data.selection!.providerId,
            modelId: event.target.value,
          })
        }
        className="hidden min-w-0 max-w-52 flex-1 bg-transparent text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block sm:max-w-64"
      >
        {activeProvider?.models.map((model) => (
          <option key={model.id} value={model.id}>{model.label}</option>
        ))}
      </select>
      {saving ? <LoaderCircle className="ml-auto animate-spin text-muted-foreground" size={13} /> : null}
    </div>
  );
}
