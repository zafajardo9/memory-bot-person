"use client";

import { KeyRound, LockKeyhole, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { CustomProviderDialog } from "@/components/settings/custom-provider-dialog";
import { ProviderSettingsCard } from "@/components/settings/provider-settings-card";

import type { AIProviderStatus } from "@/ai/providers/types";

type ProviderFilter = "all" | "active" | "custom" | "setup";

export function ProviderDirectory({
  providers,
  onChange,
  onCreated,
  onDeleted,
}: {
  providers: AIProviderStatus[];
  onChange: (provider: AIProviderStatus) => void;
  onCreated: (provider: AIProviderStatus) => void;
  onDeleted: (providerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProviderFilter>("all");

  const connectedCount = providers.filter((provider) => provider.configured).length;
  const activeCount = providers.filter(
    (provider) => provider.configured && provider.enabled,
  ).length;

  const visibleProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return providers.filter((provider) => {
      const matchesQuery =
        !normalizedQuery ||
        provider.label.toLowerCase().includes(normalizedQuery) ||
        provider.description.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && provider.configured && provider.enabled) ||
        (filter === "custom" && provider.custom) ||
        (filter === "setup" && !provider.configured);

      return matchesQuery && matchesFilter;
    });
  }, [filter, providers, query]);

  const filters: Array<{ id: ProviderFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: providers.length },
    { id: "active", label: "Active", count: activeCount },
    {
      id: "custom",
      label: "Custom",
      count: providers.filter((provider) => provider.custom).length,
    },
    {
      id: "setup",
      label: "Needs setup",
      count: providers.length - connectedCount,
    },
  ];

  return (
    <>
      <section aria-labelledby="provider-directory-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary" size={16} />
              <h2 id="provider-directory-heading" className="text-base font-semibold">
                Provider directory
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {providers.length} {providers.length === 1 ? "integration" : "integrations"} supported
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="relative block w-full sm:w-64">
              <span className="sr-only">Search providers</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={15}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search providers…"
                className="glass-soft h-10 w-full rounded-full pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <CustomProviderDialog onCreated={onCreated} />
          </div>
        </div>

        <div className="glass-soft mt-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1" aria-label="Filter providers">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`relative flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                filter === item.id
                  ? "bg-white/80 text-foreground dark:bg-white/[0.08]"
                  : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
              }`}
            >
              {item.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {item.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {visibleProviders.map((provider) => (
            <ProviderSettingsCard
              key={provider.id}
              provider={provider}
              onChange={onChange}
              onDelete={onDeleted}
            />
          ))}

          {visibleProviders.length === 0 ? (
            <div className="content-surface rounded-3xl border-dashed px-6 py-12 text-center">
              <p className="font-medium">No providers found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another search or clear the current filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="mt-4 text-sm font-medium text-primary hover:underline"
              >
                Show all providers
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="mt-9 grid gap-4 border-t pt-6 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-3 rounded-lg bg-muted/50 p-4">
          <LockKeyhole className="mt-0.5 shrink-0 text-primary" size={17} />
          <p>
            Site-managed keys are encrypted at rest and are never returned to
            the browser.
          </p>
        </div>
        <div className="flex gap-3 rounded-lg bg-muted/50 p-4">
          <KeyRound className="mt-0.5 shrink-0 text-primary" size={17} />
          <p>
            Environment credentials remain available as a fallback when no
            site-managed key exists.
          </p>
        </div>
      </aside>
    </>
  );
}
