"use client";

import { Bot, ChevronDown, LoaderCircle, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import useSWR from "swr";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetcher } from "@/lib/utils";

import type { AIProviderCatalog, AISelection } from "@/ai/providers/types";

interface PanelPosition {
  bottom?: number;
  left: number;
  maxHeight: number;
  top?: number;
  width: number;
}

export function ModelSelector({
  onAvailabilityChange,
  agentId,
}: {
  onAvailabilityChange: (available: boolean) => void;
  agentId: string;
}) {
  const { data, isLoading, mutate } = useSWR<AIProviderCatalog>(
    `/api/ai/selection?agentId=${encodeURIComponent(agentId)}`,
    fetcher,
    { revalidateOnFocus: false },
  );
  const [modelOpen, setModelOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  const modelPanelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const available = Boolean(data?.selection);
  useEffect(() => onAvailabilityChange(available), [available, onAvailabilityChange]);

  // Close model popup on outside click
  useEffect(() => {
    if (!modelOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !modelPanelRef.current?.contains(target) &&
        !modelTriggerRef.current?.contains(target)
      ) {
        setModelOpen(false);
        setModelSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelOpen]);

  useEffect(() => {
    if (!modelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModelOpen(false);
        setModelSearch("");
        modelTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modelOpen]);

  useLayoutEffect(() => {
    if (!modelOpen) return;

    const updatePanelPosition = () => {
      const trigger = modelTriggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 8;
      const width = Math.min(360, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(viewportPadding, rect.right - width),
        window.innerWidth - width - viewportPadding,
      );
      const roomAbove = rect.top - viewportPadding - gap;
      const roomBelow =
        window.innerHeight - rect.bottom - viewportPadding - gap;
      const openAbove = roomAbove >= roomBelow;

      setPanelPosition({
        left,
        maxHeight: Math.max(120, openAbove ? roomAbove : roomBelow),
        width,
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      });
    };

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [modelOpen]);

  useEffect(() => {
    if (modelOpen) searchRef.current?.focus();
  }, [modelOpen]);

  const saveSelection = async (selection: AISelection) => {
    setSaving(true);
    try {
      const response = await fetch("/api/ai/selection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selection, agentId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to change model");
      await mutate((current) =>
        current ? { ...current, selection: result.selection } : current,
      false);
      setModelOpen(false);
      setProviderOpen(false);
      setModelSearch("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to change model");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex h-7 items-center gap-1.5 text-xs text-muted-foreground">
        <LoaderCircle className="animate-spin" size={12} />
        Models…
      </div>
    );
  }

  if (!data.selection) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">No provider available.</span>
        {data.canConfigure ? (
          <Link href="/settings/ai" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <Settings2 size={12} /> Configure
          </Link>
        ) : (
          <span className="text-muted-foreground">Ask an admin to connect one.</span>
        )}
      </div>
    );
  }

  const activeProvider = data.providers.find(
    (provider) => provider.id === data.selection?.providerId,
  );
  const activeModel = activeProvider?.models.find(
    (model) => model.id === data.selection?.modelId,
  );
  const filteredModels = (activeProvider?.models ?? []).filter(
    (model) =>
      !modelSearch ||
      model.label.toLowerCase().includes(modelSearch.toLowerCase()) ||
      model.id.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  const handleProviderSelect = (providerId: string) => {
    const provider = data.providers.find((p) => p.id === providerId);
    if (!provider || provider.models.length === 0) return;
    const model =
      provider.models.find((m) => m.id === provider.defaultModelId) ??
      provider.models[0];
    if (model) {
      void saveSelection({ providerId, modelId: model.id });
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Provider trigger + Dialog */}
      <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
        <button
          type="button"
          onClick={() => {
            setProviderOpen(true);
            setModelOpen(false);
          }}
          disabled={saving}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.05] disabled:cursor-wait"
        >
          <Bot size={12} className="shrink-0 text-primary" />
          <span>{activeProvider?.label}</span>
          <ChevronDown size={10} className="shrink-0 text-muted-foreground" />
        </button>

        <DialogContent className="max-w-sm p-0">
          <DialogHeader className="px-5 pt-5 pb-2">
            <DialogTitle className="text-base">Choose provider</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-0.5 overflow-y-auto px-2 pb-3">
            {data.providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                disabled={saving || provider.models.length === 0}
                onClick={() => handleProviderSelect(provider.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  provider.id === data.selection?.providerId
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted"
                } disabled:opacity-40`}
              >
                <div className="min-w-0">
                  <span className="block truncate font-medium">
                    {provider.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {provider.description}
                  </span>
                </div>
                {provider.id === data.selection?.providerId ? (
                  <span className="ml-3 shrink-0 size-2 rounded-full bg-primary" />
                ) : (
                  <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                    {provider.models.length} models
                  </span>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Separator */}
      <span className="text-[10px] text-border">/</span>

      {/* Model trigger + popup */}
      <button
        ref={modelTriggerRef}
        type="button"
        onClick={() => {
          setModelOpen(!modelOpen);
          setProviderOpen(false);
        }}
        disabled={saving}
        aria-expanded={modelOpen}
        aria-haspopup="dialog"
        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors hover:bg-foreground/[0.05] disabled:cursor-wait"
      >
        <span className="max-w-[140px] truncate text-muted-foreground">
          {activeModel?.label ?? data.selection.modelId}
        </span>
        <ChevronDown size={10} className="shrink-0 text-muted-foreground" />
        {saving ? <LoaderCircle className="animate-spin" size={12} /> : null}
      </button>

      {/* Model popup */}
      {modelOpen && panelPosition
        ? createPortal(
            <div
              ref={modelPanelRef}
              role="dialog"
              aria-label={`${activeProvider?.label} models`}
              style={panelPosition}
              className="glass fixed z-[100] flex flex-col overflow-hidden rounded-2xl p-3 shadow-[0_12px_36px_hsl(var(--foreground)/0.10)]"
            >
              <div className="relative mb-1 shrink-0">
                <Search
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={modelSearch}
                  onChange={(event) => setModelSearch(event.target.value)}
                  placeholder={`Search ${activeProvider?.label} models…`}
                  className="w-full rounded-xl border border-black/[0.07] bg-white/50 py-1.5 pl-7 pr-2 text-xs outline-none transition-colors focus:border-primary/30 focus:bg-white/75 dark:border-white/[0.08] dark:bg-white/[0.05]"
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredModels.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    No models match your search.
                  </div>
                ) : (
                  filteredModels.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void saveSelection({
                          providerId: data.selection!.providerId,
                          modelId: model.id,
                        })
                      }
                      className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        model.id === data.selection?.modelId
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="w-full truncate font-medium">
                        {model.label}
                      </span>
                      {model.description ? (
                        <span className="w-full truncate text-[11px] text-muted-foreground">
                          {model.description}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
