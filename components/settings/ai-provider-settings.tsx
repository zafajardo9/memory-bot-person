"use client";

import { ArrowLeft, BrainCircuit, Plug2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { KnowledgeAISettingsPanel } from "@/components/settings/knowledge-ai-settings";
import { ProviderDirectory } from "@/components/settings/provider-directory";

import type { AIProviderStatus } from "@/ai/providers/types";
import type { KnowledgeAISettings } from "@/lib/knowledge/embedding-settings";

type SettingsTab = "providers" | "configuration";

const TAB_ORDER: SettingsTab[] = ["providers", "configuration"];

export function AIProviderSettings({
  initialProviders,
  initialKnowledgeSettings,
}: {
  initialProviders: AIProviderStatus[];
  initialKnowledgeSettings: KnowledgeAISettings;
}) {
  const [providers, setProviders] = useState(initialProviders);
  const [tab, setTab] = useState<SettingsTab>("providers");
  const tabRefs = useRef<Record<SettingsTab, HTMLButtonElement | null>>({
    providers: null,
    configuration: null,
  });

  const updateProvider = (provider: AIProviderStatus) => {
    setProviders((current) =>
      current.map((candidate) =>
        candidate.id === provider.id ? provider : candidate,
      ),
    );
  };

  const addProvider = (provider: AIProviderStatus) => {
    setProviders((current) => [...current, provider]);
  };

  const removeProvider = (providerId: string) => {
    setProviders((current) =>
      current.filter((provider) => provider.id !== providerId),
    );
  };

  const connectedCount = providers.filter((provider) => provider.configured).length;
  const activeCount = providers.filter(
    (provider) => provider.configured && provider.enabled,
  ).length;

  const knowledgeProviderReady = providers.some(
    (provider) =>
      provider.id === initialKnowledgeSettings.selection.providerId &&
      provider.configured &&
      provider.enabled,
  );

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    description: string;
    icon: typeof Plug2;
    attention?: boolean;
  }> = [
    {
      id: "providers",
      label: "AI providers",
      description: "Connect keys and manage chat models",
      icon: Plug2,
    },
    {
      id: "configuration",
      label: "AI configuration",
      description: "Workspace-wide model behavior",
      icon: BrainCircuit,
      attention: !knowledgeProviderReady,
    },
  ];

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    id: SettingsTab,
  ) => {
    const index = TAB_ORDER.indexOf(id);
    let next: SettingsTab | null = null;

    if (event.key === "ArrowRight") {
      next = TAB_ORDER[(index + 1) % TAB_ORDER.length];
    } else if (event.key === "ArrowLeft") {
      next = TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    } else if (event.key === "Home") {
      next = TAB_ORDER[0];
    } else if (event.key === "End") {
      next = TAB_ORDER[TAB_ORDER.length - 1];
    }

    if (next) {
      event.preventDefault();
      setTab(next);
      tabRefs.current[next]?.focus();
    }
  };

  return (
    <main className="page-shell overflow-hidden">
      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to notebook
        </Link>

        <header className="mt-8 grid gap-7 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="flex items-start gap-4">
            <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SlidersHorizontal size={20} />
            </span>
            <div>
              <p className="eyebrow">Workspace controls</p>
              <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                AI settings
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Connect the providers your team trusts, then configure which
                models power chat and knowledge processing.
              </p>
            </div>
          </div>

          <div className="glass-soft grid grid-cols-2 overflow-hidden rounded-2xl">
            <div className="min-w-28 px-4 py-3">
              <div className="font-mono text-xl font-semibold tabular-nums">
                {activeCount}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Active</div>
            </div>
            <div className="min-w-28 border-l px-4 py-3">
              <div className="font-mono text-xl font-semibold tabular-nums">
                {connectedCount}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">Connected</div>
            </div>
          </div>
        </header>

        <div
          role="tablist"
          aria-label="AI settings sections"
          className="glass-soft flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl p-1.5"
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                ref={(element) => {
                  tabRefs.current[item.id] = element;
                }}
                type="button"
                role="tab"
                id={`${item.id}-tab`}
                aria-selected={selected}
                aria-controls={`${item.id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => handleTabKeyDown(event, item.id)}
                className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                }`}
              >
                <Icon size={15} />
                {item.label}
                {item.attention ? (
                  <span
                    className={`size-1.5 rounded-full ${
                      selected ? "bg-primary-foreground" : "bg-amber-500"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {tabs.find((item) => item.id === tab)?.description}
        </p>

        <div
          role="tabpanel"
          id="providers-panel"
          aria-labelledby="providers-tab"
          hidden={tab !== "providers"}
          className="mt-8"
        >
          <ProviderDirectory
            providers={providers}
            onChange={updateProvider}
            onCreated={addProvider}
            onDeleted={removeProvider}
          />
        </div>

        <div
          role="tabpanel"
          id="configuration-panel"
          aria-labelledby="configuration-tab"
          hidden={tab !== "configuration"}
          className="mt-8"
        >
          <KnowledgeAISettingsPanel
            initialSettings={initialKnowledgeSettings}
            providerStatuses={providers}
          />
        </div>
      </div>
    </main>
  );
}
