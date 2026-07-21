"use client";

import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ProviderSettingsCard } from "@/components/settings/provider-settings-card";

import type { AIProviderStatus } from "@/ai/providers/types";

type ProviderFilter = "all" | "active" | "setup";

export function AIProviderSettings({
  initialProviders,
}: {
  initialProviders: AIProviderStatus[];
}) {
  const [providers, setProviders] = useState(initialProviders);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProviderFilter>("all");

  const updateProvider = (provider: AIProviderStatus) => {
    setProviders((current) =>
      current.map((candidate) =>
        candidate.id === provider.id ? provider : candidate,
      ),
    );
  };

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
        (filter === "setup" && !provider.configured);

      return matchesQuery && matchesFilter;
    });
  }, [filter, providers, query]);

  const filters: Array<{ id: ProviderFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: providers.length },
    { id: "active", label: "Active", count: activeCount },
    {
      id: "setup",
      label: "Needs setup",
      count: providers.length - connectedCount,
    },
  ];

  return (
    <main className="page-shell overflow-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-16 -z-0 h-72 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.09),transparent_62%)]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to notebook
        </Link>

        <header className="mt-8 grid gap-7 border-b pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="flex items-start gap-4">
            <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
              <SlidersHorizontal size={20} />
            </span>
            <div>
              <p className="eyebrow">Workspace controls</p>
              <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                AI model catalog
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Connect the providers your team trusts, then choose which models
                are available in chat. New providers will appear here as they
                become supported.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card shadow-sm">
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

        <section className="mt-7" aria-labelledby="provider-directory-heading">
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

            <label className="relative block w-full sm:w-72">
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
                className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </label>
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto border-b" aria-label="Filter providers">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={`relative flex shrink-0 items-center gap-2 px-3 pb-3 text-sm font-medium transition-colors ${
                  filter === item.id
                    ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
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
                onChange={updateProvider}
              />
            ))}

            {visibleProviders.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
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
      </div>
    </main>
  );
}
