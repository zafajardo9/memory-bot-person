"use client";

import { Bot, ChevronDown, LoaderCircle, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import useSWR from "swr";

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
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const available = Boolean(data?.selection);
  useEffect(() => onAvailabilityChange(available), [available, onAvailabilityChange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
        setModelSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setModelSearch("");
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const trigger = triggerRef.current;
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
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

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
      setOpen(false);
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

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        disabled={saving}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted disabled:cursor-wait"
      >
        <Bot size={12} className="shrink-0 text-primary" />
        <span className="font-medium text-foreground">{activeProvider?.label}</span>
        <span className="text-border">/</span>
        <span className="max-w-[160px] truncate text-muted-foreground">
          {activeModel?.label ?? data.selection.modelId}
        </span>
        <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
        {saving ? <LoaderCircle className="animate-spin" size={12} /> : null}
      </button>

      {open && panelPosition
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Choose AI provider and model"
              style={panelPosition}
              className="fixed z-[100] flex flex-col overflow-hidden rounded-lg border bg-card p-3 shadow-xl"
            >
              <div className="mb-2 flex shrink-0 flex-wrap gap-1">
                {data.providers.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    disabled={saving || provider.models.length === 0}
                    onClick={() => {
                      const model =
                        provider.models.find(
                          (candidate) =>
                            candidate.id === provider.defaultModelId,
                        ) ?? provider.models[0];

                      if (model) {
                        void saveSelection({
                          providerId: provider.id,
                          modelId: model.id,
                        });
                      }
                    }}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      provider.id === data.selection?.providerId
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    } disabled:opacity-40`}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>

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
                  placeholder="Search models…"
                  className="w-full rounded-md border bg-muted/50 py-1.5 pl-7 pr-2 text-xs outline-none transition-colors focus:border-primary/40 focus:bg-muted"
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
