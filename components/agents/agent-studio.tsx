"use client";

import {
  ArrowRight,
  BookOpen,
  Bot,
  Brain,
  Check,
  Compass,
  MessageSquareText,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AgentSummary {
  id: string;
  name: string;
  description: string;
  avatar: string;
  color: string;
  enabledTools: string[];
  isDefault: boolean;
  _count: {
    chats: number;
    memories: number;
    knowledgeSources: number;
  };
}

const colorStyles: Record<string, string> = {
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  blue: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  rose: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  slate: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

const avatarIcons = {
  spark: Sparkles,
  compass: Compass,
  brain: Brain,
  book: BookOpen,
  code: Wrench,
  briefcase: Bot,
};

async function apiError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "The agent could not be updated.";
}

export function AgentStudio({ initialAgents }: { initialAgents: AgentSummary[] }) {
  const [agents, setAgents] = useState(initialAgents);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentSummary | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    color: "blue",
    avatar: "compass",
  });

  async function createAgent() {
    setCreating(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const { agent } = (await response.json()) as { agent: AgentSummary };
      setAgents((current) => [...current, agent]);
      setDraft({ name: "", description: "", color: "blue", avatar: "compass" });
      setCreateOpen(false);
      toast.success(`${agent.name} joined your workspace.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create agent.");
    } finally {
      setCreating(false);
    }
  }

  async function makeDefault(agent: AgentSummary) {
    const response = await fetch(`/api/agents/${agent.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ makeDefault: true }),
    });
    if (!response.ok) {
      toast.error(await apiError(response));
      return;
    }
    setAgents((current) =>
      current.map((item) => ({ ...item, isDefault: item.id === agent.id })),
    );
    toast.success(`${agent.name} is now your default agent.`);
  }

  async function removeAgent() {
    if (!deleteTarget) return;
    const response = await fetch(`/api/agents/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error(await apiError(response));
      return;
    }
    setAgents((current) => current.filter(({ id }) => id !== deleteTarget.id));
    toast.success(`${deleteTarget.name} was removed.`);
    setDeleteTarget(null);
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_12%_5%,hsl(var(--primary)/0.10),transparent_34rem)] px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="grid gap-6 border-b pb-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow">Agent workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Build a team of focused minds.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Every agent keeps its own memory, notebook, model, and tool belt.
              Switch contexts without mixing what each one knows.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full gap-2 rounded-xl sm:w-fit"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={17} /> Create agent
          </Button>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => {
            const Icon =
              avatarIcons[agent.avatar as keyof typeof avatarIcons] ?? Sparkles;
            return (
              <article
                key={agent.id}
                className="group flex min-h-72 flex-col rounded-2xl border bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex size-12 items-center justify-center rounded-2xl border ${
                      colorStyles[agent.color] ?? colorStyles.violet
                    }`}
                  >
                    <Icon size={21} />
                  </span>
                  {agent.isDefault ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                      <Check size={11} /> Default
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void makeDefault(agent)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Make default
                    </button>
                  )}
                </div>
                <h2 className="mt-5 text-xl font-semibold tracking-[-0.025em]">
                  {agent.name}
                </h2>
                <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
                  {agent.description || "A focused assistant ready for its own mission."}
                </p>

                <div className="mt-5 grid grid-cols-3 divide-x rounded-xl border bg-muted/20 py-3 text-center">
                  <Metric value={agent._count.chats} label="Chats" />
                  <Metric value={agent._count.memories} label="Memories" />
                  <Metric value={agent._count.knowledgeSources} label="Sources" />
                </div>

                <div className="mt-auto flex items-center gap-2 pt-5">
                  <Button asChild className="flex-1 rounded-xl">
                    <Link href={`/agents/${agent.id}/chat`}>
                      Chat <ArrowRight size={14} />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    className="rounded-xl"
                    aria-label={`Open ${agent.name} settings`}
                  >
                    <Link href={`/agents/${agent.id}/settings`}>
                      <Settings2 size={15} />
                    </Link>
                  </Button>
                  {!agent.isDefault ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(agent)}
                      aria-label={`Delete ${agent.name}`}
                    >
                      <Trash2 size={15} />
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a focused agent</DialogTitle>
            <DialogDescription>
              Start with full tool access. You can tune its tools, memory, notebook,
              voice, and model independently afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-agent-name">Name</Label>
              <Input
                id="new-agent-name"
                autoFocus
                maxLength={60}
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Research partner"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-agent-description">Mission</Label>
              <Textarea
                id="new-agent-description"
                maxLength={240}
                rows={3}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Investigates technical questions and keeps a notebook of trusted sources."
                className="resize-none rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(colorStyles).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, color }))}
                  className={`rounded-xl border px-3 py-2 text-left text-sm capitalize ${
                    draft.color === color
                      ? colorStyles[color]
                      : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void createAgent()}
              disabled={creating || !draft.name.trim()}
            >
              {creating ? "Creating…" : "Create agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              Its chats and private memories will also be deleted. Shared source
              documents remain available to other agents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Keep agent
            </Button>
            <Button variant="destructive" onClick={() => void removeAgent()}>
              Delete agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-mono text-sm font-semibold">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
