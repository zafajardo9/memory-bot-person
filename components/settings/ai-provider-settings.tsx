"use client";

import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  CircleAlert,
  DatabaseZap,
  Plug2,
  Settings2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { KnowledgeAISettingsPanel } from "@/components/settings/knowledge-ai-settings";
import { ProviderDirectory } from "@/components/settings/provider-directory";
import { ResearchAISettingsPanel } from "@/components/settings/research-ai-settings";

import type { WorkspaceAISettings } from "@/ai/providers/research-settings";
import type { AIProviderStatus } from "@/ai/providers/types";
import type { KnowledgeAISettings } from "@/lib/knowledge/embedding-settings";

type SettingsTab = "configuration" | "providers";

const TAB_ORDER: SettingsTab[] = ["configuration", "providers"];

export function AIProviderSettings({
  initialProviders,
  initialKnowledgeSettings,
  initialResearchSettings,
}: {
  initialProviders: AIProviderStatus[];
  initialKnowledgeSettings: KnowledgeAISettings;
  initialResearchSettings: WorkspaceAISettings;
}) {
  const [providers, setProviders] = useState(initialProviders);
  const [tab, setTab] = useState<SettingsTab>("configuration");
  const [researchSettings, setResearchSettings] = useState(initialResearchSettings);
  const tabRefs = useRef<Record<SettingsTab, HTMLButtonElement | null>>({
    configuration: null,
    providers: null,
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
  const providerIsReady = (providerId?: string) =>
    Boolean(
      providerId &&
        providers.some(
          (provider) =>
            provider.id === providerId && provider.configured && provider.enabled,
        ),
    );
  const knowledgeReady = providerIsReady(
    initialKnowledgeSettings.selection.providerId,
  );
  const thinkingReady = providerIsReady(
    researchSettings.selection?.providerId,
  );
  const humanizerReady = providerIsReady(
    researchSettings.humanizerSelection?.providerId,
  );
  const readyRoles = [knowledgeReady, thinkingReady, humanizerReady].filter(
    Boolean,
  ).length;

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    description: string;
    icon: typeof Plug2;
    meta: string;
    attention?: boolean;
  }> = [
    {
      id: "configuration",
      label: "Workspace roles",
      description: "Set the models behind research, answers, and memory.",
      icon: BrainCircuit,
      meta: `${readyRoles}/3 ready`,
      attention: readyRoles < 3,
    },
    {
      id: "providers",
      label: "Provider connections",
      description: "Manage credentials and available model catalogs.",
      icon: Plug2,
      meta: `${activeCount}/${providers.length} active`,
      attention: connectedCount < providers.length,
    },
  ];

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    id: SettingsTab,
  ) => {
    const index = TAB_ORDER.indexOf(id);
    let next: SettingsTab | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      next = TAB_ORDER[(index + 1) % TAB_ORDER.length];
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_70%_0%,hsl(var(--primary)/0.13),transparent_56%)]" />
      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
        >
          <ArrowLeft size={14} />
          Back to notebook
        </Link>

        <header className="mt-12 border-b pb-7 sm:mt-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Settings2 size={16} />
                <p className="eyebrow text-primary">AI control room</p>
              </div>
              <h1 className="text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                Shape how Memory thinks.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Connect trusted AI services, then assign each one a clear job in
                your workspace. Changes here affect every new conversation.
              </p>
            </div>

            <dl className="grid grid-cols-3 overflow-hidden rounded-2xl border bg-background/65 shadow-sm backdrop-blur-sm">
              <StatusMetric label="Roles ready" value={`${readyRoles}/3`} />
              <StatusMetric label="Active" value={String(activeCount)} bordered />
              <StatusMetric label="Connected" value={String(connectedCount)} bordered />
            </dl>
          </div>
        </header>

        <div className="mt-7 grid gap-7 lg:grid-cols-[16rem_minmax(0,1fr)] xl:gap-10">
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div
              role="tablist"
              aria-label="AI settings sections"
              aria-orientation="vertical"
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1"
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
                    className={`group flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left outline-none transition-[background-color,border-color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
                      selected
                        ? "border-primary/25 bg-primary/[0.075] shadow-sm"
                        : "bg-background/45 hover:-translate-y-0.5 hover:border-foreground/15 hover:bg-background/80"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{item.label}</span>
                        <ArrowRight
                          className={`shrink-0 transition-transform ${
                            selected ? "translate-x-0 text-primary" : "-translate-x-1 text-muted-foreground"
                          }`}
                          size={14}
                        />
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </span>
                      <span
                        className={`mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ${
                          item.attention ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {item.attention ? <CircleAlert size={11} /> : <Check size={11} />}
                        {item.meta}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 hidden rounded-2xl border bg-muted/35 p-4 lg:block">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Sparkles className="text-primary" size={14} />
                Workspace AI map
              </div>
              <div className="mt-4 space-y-3">
                <RoleStatus icon={DatabaseZap} label="Knowledge" ready={knowledgeReady} />
                <RoleStatus icon={BrainCircuit} label="Thinking" ready={thinkingReady} />
                <RoleStatus icon={Sparkles} label="Humanizer" ready={humanizerReady} />
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div
              role="tabpanel"
              id="configuration-panel"
              aria-labelledby="configuration-tab"
              hidden={tab !== "configuration"}
            >
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow">Workspace architecture</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                    Give every model one clear job
                  </h2>
                </div>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground sm:text-right">
                  Knowledge prepares context. Thinking investigates. Humanizer
                  turns the result into the answer people read.
                </p>
              </div>
              <div className="grid gap-5">
                <ResearchAISettingsPanel
                  initialSettings={researchSettings}
                  providerStatuses={providers}
                  onChange={setResearchSettings}
                />
                <KnowledgeAISettingsPanel
                  initialSettings={initialKnowledgeSettings}
                  providerStatuses={providers}
                />
              </div>
            </div>

            <div
              role="tabpanel"
              id="providers-panel"
              aria-labelledby="providers-tab"
              hidden={tab !== "providers"}
            >
              <ProviderDirectory
                providers={providers}
                onChange={updateProvider}
                onCreated={addProvider}
                onDeleted={removeProvider}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatusMetric({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={`flex min-w-24 flex-col px-4 py-3.5 sm:min-w-32 ${bordered ? "border-l" : ""}`}
    >
      <dt className="order-2 mt-0.5 text-[11px] text-muted-foreground">
        {label}
      </dt>
      <dd className="order-1 font-mono text-lg font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function RoleStatus({
  icon: Icon,
  label,
  ready,
}: {
  icon: typeof BrainCircuit;
  label: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
        <Icon size={13} />
      </span>
      <span className="flex-1 text-xs font-medium">{label}</span>
      <span
        className={`size-2 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`}
        aria-label={ready ? `${label} ready` : `${label} needs attention`}
      />
    </div>
  );
}
