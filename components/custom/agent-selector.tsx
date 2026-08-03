"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/utils";

import { useResolvedActiveAgentId } from "./active-agent-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface AgentOption {
  id: string;
  name: string;
  description: string;
  color: string;
  avatar: string;
  isDefault: boolean;
}

const colorStyles: Record<string, string> = {
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  blue: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  rose: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  slate: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

/**
 * Agent switcher shown at the top of chat. Lists every agent the user owns and
 * starts a fresh conversation with the chosen one (/agents/<id>/chat).
 */
export function AgentSelector() {
  const [open, setOpen] = useState(false);
  const { data } = useSWR<{ agents: AgentOption[] }>("/api/agents", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const agents = data?.agents ?? [];
  const defaultAgent = agents.find((agent) => agent.isDefault);
  const currentAgentId = useResolvedActiveAgentId(defaultAgent?.id);
  const currentAgent = agents.find((agent) => agent.id === currentAgentId);
  const currentAgentName = currentAgent?.name ?? "Agents";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-9 shrink-0 items-center gap-2 rounded-full px-1.5 text-left transition-colors hover:bg-foreground/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5"
          aria-label={`Switch agent — currently ${currentAgentName}`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-400 text-[10px] font-semibold uppercase text-white shadow-[0_3px_12px_hsl(var(--primary)/0.22)]">
            {currentAgentName.charAt(0)}
          </span>
          <span className="hidden max-w-32 truncate text-xs font-medium sm:block lg:max-w-40">
            {currentAgentName}
          </span>
          <ChevronDown
            size={14}
            className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-72 p-1.5"
      >
        <DropdownMenuLabel className="px-2 pb-1 pt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Switch agent
        </DropdownMenuLabel>
        <div className="max-h-80 overflow-y-auto">
          {agents.map((agent) => {
            const isCurrent = agent.id === currentAgentId;
            const colorClass = colorStyles[agent.color] ?? colorStyles.violet;
            return (
              <DropdownMenuItem
                key={agent.id}
                asChild
                className="h-auto gap-3 rounded-lg p-2"
              >
                <Link
                  href={`/agents/${agent.id}/chat`}
                  onClick={(event) => {
                    if (isCurrent) event.preventDefault();
                    setOpen(false);
                  }}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold uppercase ${colorClass}`}
                  >
                    {agent.name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {agent.name}
                      {agent.isDefault ? (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                          Default
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {agent.description || "Focused assistant"}
                    </span>
                  </span>
                  {isCurrent ? (
                    <Check size={15} className="shrink-0 text-primary" />
                  ) : null}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2 rounded-lg">
          <Link href="/agents" onClick={() => setOpen(false)}>
            <Plus size={14} className="text-muted-foreground" />
            Manage agents
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
