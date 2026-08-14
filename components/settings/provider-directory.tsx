"use client";

import {
  KeyRound,
  Search,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
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
    <section aria-labelledby="provider-directory-heading">
      <div className="rounded-3xl border bg-[linear-gradient(135deg,hsl(var(--primary)/0.09),transparent_55%)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-primary">
              <ServerCog size={16} />
              <p className="eyebrow text-primary">Connection layer</p>
            </div>
            <h2
              id="provider-directory-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.035em]"
            >
              Provider connections
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Credentials unlock model catalogs. Expand a provider to test its
              connection, choose defaults, or control workspace availability.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
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
                className="h-10 w-full rounded-xl border bg-background/80 pl-9 pr-3 text-sm shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <CustomProviderDialog onCreated={onCreated} />
          </div>
        </div>

        <div
          className="mt-5 flex max-w-full flex-wrap gap-1.5"
          aria-label="Filter providers"
        >
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                filter === item.id
                  ? "border-primary/25 bg-primary text-primary-foreground"
                  : "border-transparent bg-background/65 text-muted-foreground hover:border-foreground/10 hover:text-foreground"
              }`}
            >
              {item.label}
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  filter === item.id ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {visibleProviders.map((provider) => (
          <ProviderSettingsCard
            key={provider.id}
            provider={provider}
            onChange={onChange}
            onDelete={onDeleted}
          />
        ))}

        {visibleProviders.length === 0 ? (
          <div className="content-surface rounded-3xl border-dashed px-6 py-14 text-center md:col-span-2">
            <Search className="mx-auto text-muted-foreground" size={22} />
            <p className="mt-4 font-semibold">No matching providers</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Change the search or return to the full provider catalog.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="mt-4 rounded-lg text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
            >
              Show all providers
            </button>
          </div>
        ) : null}
      </div>

      <aside className="mt-6 grid gap-3 border-t pt-5 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-3 rounded-2xl bg-muted/45 p-4">
          <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={17} />
          <div>
            <p className="font-medium text-foreground">Encrypted workspace keys</p>
            <p className="mt-1">
              Site-managed credentials are encrypted at rest and never returned
              to the browser.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-2xl bg-muted/45 p-4">
          <KeyRound className="mt-0.5 shrink-0 text-primary" size={17} />
          <div>
            <p className="font-medium text-foreground">Environment fallback</p>
            <p className="mt-1">
              Environment credentials remain available when a site-managed key
              has not been stored.
            </p>
          </div>
        </div>
      </aside>
    </section>
  );
}
