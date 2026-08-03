"use client";

import {
  Brain,
  Check,
  ChevronRight,
  MessageCircleMore,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AGENT_MOODS,
  RESPONSE_LENGTHS,
  type AgentMood,
  type AgentSettings,
  type ResponseLayer,
  type ResponseLength,
} from "@/lib/agent-settings";
import { AGENT_TOOLS, type AgentTool } from "@/lib/agents";

type MemoryCategory = "fact" | "preference" | "context" | "note";

interface MemoryItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  priority: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

const moodDetails: Record<
  AgentMood,
  { label: string; description: string; sample: string }
> = {
  balanced: {
    label: "Balanced",
    description: "Clear and natural",
    sample: "Here’s the clearest way to approach it.",
  },
  warm: {
    label: "Warm",
    description: "Patient and encouraging",
    sample: "Absolutely — we can work through this together.",
  },
  upbeat: {
    label: "Upbeat",
    description: "Energetic and optimistic",
    sample: "Great idea. Here’s a practical way to get moving.",
  },
  calm: {
    label: "Calm",
    description: "Reassuring and unhurried",
    sample: "Let’s take this one step at a time.",
  },
  direct: {
    label: "Direct",
    description: "Plain and to the point",
    sample: "Start with the highest-impact change.",
  },
  analytical: {
    label: "Analytical",
    description: "Precise and methodical",
    sample: "There are three tradeoffs to evaluate first.",
  },
};

const lengthDetails: Record<
  ResponseLength,
  { label: string; description: string }
> = {
  concise: { label: "Concise", description: "Short, action-first replies" },
  balanced: { label: "Balanced", description: "Enough context to be useful" },
  detailed: { label: "Detailed", description: "Thorough explanations and examples" },
};

const categoryLabels: Record<MemoryCategory, string> = {
  fact: "Fact",
  preference: "Preference",
  context: "Context",
  note: "Note",
};

async function responseError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return data?.error ?? fallback;
}

export function AgentSettingsPanel({
  agentId,
  initialSettings,
  initialMemories,
  initialEnabledTools,
}: {
  agentId: string;
  initialSettings: AgentSettings;
  initialMemories: MemoryItem[];
  initialEnabledTools: string[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [enabledTools, setEnabledTools] = useState(initialEnabledTools);
  const [savedTools, setSavedTools] = useState(initialEnabledTools);
  const [memories, setMemories] = useState(initialMemories);
  const [saving, setSaving] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState({
    title: "",
    content: "",
    category: "preference" as MemoryCategory,
    tags: "",
    priority: 5,
  });

  const [activeTab, setActiveTab] = useState<"voice" | "tools" | "memories">("voice");

  const layerId = useId();

  const hasChanges = useMemo(
    () =>
      JSON.stringify(settings) !== JSON.stringify(savedSettings) ||
      JSON.stringify(enabledTools) !== JSON.stringify(savedTools),
    [enabledTools, savedSettings, savedTools, settings],
  );

  async function saveSettings() {
    setSaving(true);
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settings.agentName,
          mood: settings.mood,
          responseLength: settings.responseLength,
          customInstructions: settings.customInstructions,
          responseLayers: settings.responseLayers,
          enabledTools,
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Unable to save settings."));
      }
      const data = (await response.json()) as {
        agent: {
          name: string;
          mood: AgentMood;
          responseLength: ResponseLength;
          customInstructions: string;
          responseLayers?: ResponseLayer[];
          enabledTools: string[];
        };
      };
      const nextSettings = {
        agentName: data.agent.name,
        mood: data.agent.mood,
        responseLength: data.agent.responseLength,
        customInstructions: data.agent.customInstructions,
        responseLayers: data.agent.responseLayers ?? [],
      };
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      setEnabledTools(data.agent.enabledTools);
      setSavedTools(data.agent.enabledTools);
      toast.success(`${data.agent.name} is tuned and ready.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addMemory() {
    setAddingMemory(true);
    try {
      const response = await fetch("/api/user-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          ...memoryDraft,
          tags: memoryDraft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Unable to save memory."));
      }
      const { memory } = (await response.json()) as { memory: MemoryItem };
      setMemories((current) => [
        memory,
        ...current.filter((item) => item.id !== memory.id),
      ]);
      setMemoryDraft({
        title: "",
        content: "",
        category: "preference",
        tags: "",
        priority: 5,
      });
      toast.success("Memory saved. It will be available in future chats.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save memory.",
      );
    } finally {
      setAddingMemory(false);
    }
  }

  async function deleteMemory() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/user-memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id, agentId }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Unable to delete memory."));
      }
      setMemories((current) =>
        current.filter((memory) => memory.id !== deleteTarget.id),
      );
      toast.success("Memory forgotten.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete memory.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const selectedMood = moodDetails[settings.mood];

  return (
    <main className="min-h-dvh bg-transparent px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles size={13} />
              Personal agent profile
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              Shape how your agent thinks out loud.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Give your assistant a name, tune its voice, and decide what it
              should carry from one conversation to the next.
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit rounded-xl">
            <Link href={`/agents/${agentId}/chat`}>
              Open chat <ChevronRight size={15} />
            </Link>
          </Button>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="content-surface overflow-hidden rounded-3xl">
              {/* Tab bar */}
              <div className="m-2 flex rounded-full bg-foreground/[0.04] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("voice")}
                  className={`flex-1 rounded-full px-3 py-2.5 text-xs font-medium transition-colors sm:px-5 sm:text-sm ${
                    activeTab === "voice"
                      ? "bg-white/80 text-foreground dark:bg-white/[0.08]"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                  }`}
                >
                  <MessageCircleMore size={15} className="mr-2 inline" />
                  Voice &amp; Behavior
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tools")}
                  className={`flex-1 rounded-full px-3 py-2.5 text-xs font-medium transition-colors sm:px-5 sm:text-sm ${
                    activeTab === "tools"
                      ? "bg-white/80 text-foreground dark:bg-white/[0.08]"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                  }`}
                >
                  <Wrench size={15} className="mr-2 inline" />
                  Tools
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("memories")}
                  className={`flex-1 rounded-full px-3 py-2.5 text-xs font-medium transition-colors sm:px-5 sm:text-sm ${
                    activeTab === "memories"
                      ? "bg-white/80 text-foreground dark:bg-white/[0.08]"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                  }`}
                >
                  <Brain size={15} className="mr-2 inline" />
                  Memories
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {memories.length}
                  </span>
                </button>
              </div>

              {/* Voice tab */}
              {activeTab === "voice" && (
                <div className="space-y-7 p-5 sm:p-6">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Agent name</Label>
                    <Input
                      id="agent-name"
                      value={settings.agentName}
                      maxLength={60}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          agentName: event.target.value,
                        }))
                      }
                      className="h-11 rounded-xl"
                      placeholder="Kairo"
                    />
                    <p className="text-xs text-muted-foreground">
                      This name appears in chat and in the message composer.
                    </p>
                  </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Mood and tone</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {AGENT_MOODS.map((mood) => {
                      const detail = moodDetails[mood];
                      const active = settings.mood === mood;
                      return (
                        <button
                          key={mood}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setSettings((current) => ({ ...current, mood }))
                          }
                          className={`flex min-h-16 items-center justify-between rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow] ${
                            active
                              ? "border-primary/45 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.12)]"
                              : "hover:border-foreground/20 hover:bg-muted/40"
                          }`}
                        >
                          <span>
                            <span className="block text-sm font-medium">
                              {detail.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {detail.description}
                            </span>
                          </span>
                          {active ? (
                            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check size={13} />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Answer length</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {RESPONSE_LENGTHS.map((length) => {
                      const detail = lengthDetails[length];
                      const active = settings.responseLength === length;
                      return (
                        <button
                          key={length}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setSettings((current) => ({
                              ...current,
                              responseLength: length,
                            }))
                          }
                          className={`rounded-xl border p-3 text-left transition-colors ${
                            active
                              ? "border-primary/45 bg-primary/5"
                              : "hover:border-foreground/20 hover:bg-muted/40"
                          }`}
                        >
                          <span className="block text-sm font-medium">
                            {detail.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                            {detail.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-4">
                    <Label htmlFor="custom-instructions">
                      Extra behavior instructions
                    </Label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {settings.customInstructions.length}/3000
                    </span>
                  </div>
                  <Textarea
                    id="custom-instructions"
                    value={settings.customInstructions}
                    maxLength={3000}
                    rows={5}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        customInstructions: event.target.value,
                      }))
                    }
                    className="resize-y rounded-xl"
                    placeholder="For example: Use plain language, explain acronyms, and end plans with the next concrete action."
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    These preferences shape delivery. Privacy, safety, and
                    approved company sources always keep priority.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-medium">Response layers</h3>
                      <p className="text-xs text-muted-foreground">
                        Structure how the agent breaks down its answers — add
                        labels like Summarization, Details, or Related Keywords
                        with instructions for each.
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {settings.responseLayers.length}/20
                    </span>
                  </div>

                  {settings.responseLayers.length > 0 ? (
                    <div className="space-y-3">
                      {settings.responseLayers.map((layer, index) => (
                        <div
                          key={layer.id}
                          className="group relative rounded-xl border bg-muted/30 p-4"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSettings((current) => ({
                                ...current,
                                responseLayers: current.responseLayers.filter(
                                  (l) => l.id !== layer.id,
                                ),
                              }))
                            }
                            className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                            aria-label={`Remove ${layer.label || "layer"}`}
                          >
                            <X size={14} />
                          </button>
                          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                            <Input
                              value={layer.label}
                              maxLength={80}
                              onChange={(event) =>
                                setSettings((current) => {
                                  const updated = [...current.responseLayers];
                                  updated[index] = {
                                    ...updated[index],
                                    label: event.target.value,
                                  };
                                  return {
                                    ...current,
                                    responseLayers: updated,
                                  };
                                })
                              }
                              placeholder="Summarization"
                              className="h-9 rounded-lg text-sm"
                            />
                            <Textarea
                              value={layer.content}
                              maxLength={2000}
                              rows={2}
                              onChange={(event) =>
                                setSettings((current) => {
                                  const updated = [...current.responseLayers];
                                  updated[index] = {
                                    ...updated[index],
                                    content: event.target.value,
                                  };
                                  return {
                                    ...current,
                                    responseLayers: updated,
                                  };
                                })
                              }
                              placeholder="Start with a 2–3 sentence summary before diving into details."
                              className="resize-y rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed py-8 text-center">
                      <p className="text-sm font-medium text-muted-foreground">
                        No response layers yet
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add structured guidelines like Summarization, Details,
                        or Related Keywords.
                      </p>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={settings.responseLayers.length >= 20}
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        responseLayers: [
                          ...current.responseLayers,
                          {
                            id: `${layerId}-${current.responseLayers.length}`,
                            label: "",
                            content: "",
                          },
                        ],
                      }))
                    }
                    className="rounded-lg"
                  >
                    <Plus size={14} />
                    Add layer
                  </Button>
                </div>

                <div className="flex justify-end border-t pt-5">
                  <Button
                    type="button"
                    onClick={saveSettings}
                    disabled={
                      saving || !hasChanges || !settings.agentName.trim()
                    }
                    className="rounded-xl"
                  >
                    <Save size={15} />
                    {saving ? "Saving…" : "Save agent"}
                  </Button>
                </div>
              </div>
              )}

              {activeTab === "tools" && (
                <div className="space-y-6 p-5 sm:p-6">
                  <div>
                    <h2 className="font-semibold">Agent capabilities</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Choose which connected tools this agent can use. Credentials
                      remain managed centrally; this controls access per agent.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {AGENT_TOOLS.map((tool) => {
                      const active = enabledTools.includes(tool);
                      const descriptions: Record<AgentTool, string> = {
                        knowledge: "Search and read this agent’s notebook",
                        memory: "Save and recall private agent memories",
                        web: "Search and extract public web pages",
                        browser: "Browse interactive websites with permission",
                        weather: "Check live weather conditions",
                        flights: "Search flights and manage travel flows",
                      };
                      return (
                        <button
                          key={tool}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setEnabledTools((current) =>
                              active
                                ? current.filter((item) => item !== tool)
                                : [...current, tool],
                            )
                          }
                          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                            active
                              ? "border-primary/40 bg-primary/5"
                              : "hover:border-foreground/20 hover:bg-muted/30"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {active ? <Check size={13} /> : <Wrench size={12} />}
                          </span>
                          <span>
                            <span className="block text-sm font-medium capitalize">
                              {tool}
                            </span>
                            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                              {descriptions[tool]}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-end border-t pt-5">
                    <Button
                      type="button"
                      onClick={saveSettings}
                      disabled={saving || !hasChanges}
                      className="rounded-xl"
                    >
                      <Save size={15} />
                      {saving ? "Saving…" : "Save capabilities"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Memories tab */}
              {activeTab === "memories" && (
                <div className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="font-semibold">What to remember</h2>
                      <p className="text-sm text-muted-foreground">
                        Private facts and preferences available across chats.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                      {memories.length}/200
                    </span>
                  </div>
                <div className="rounded-xl border border-dashed bg-muted/20 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="memory-title">Memory title</Label>
                      <Input
                        id="memory-title"
                        maxLength={200}
                        value={memoryDraft.title}
                        onChange={(event) =>
                          setMemoryDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="How I like project updates"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memory-category">Type</Label>
                      <select
                        id="memory-category"
                        value={memoryDraft.category}
                        onChange={(event) =>
                          setMemoryDraft((current) => ({
                            ...current,
                            category: event.target.value as MemoryCategory,
                          }))
                        }
                        className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="memory-content">What should it know?</Label>
                    <Textarea
                      id="memory-content"
                      maxLength={4000}
                      rows={3}
                      value={memoryDraft.content}
                      onChange={(event) =>
                        setMemoryDraft((current) => ({
                          ...current,
                          content: event.target.value,
                        }))
                      }
                      placeholder="I prefer concise updates with blockers and the next decision highlighted."
                      className="resize-y rounded-xl"
                    />
                  </div>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label htmlFor="memory-tags">Tags (optional)</Label>
                      <Input
                        id="memory-tags"
                        value={memoryDraft.tags}
                        onChange={(event) =>
                          setMemoryDraft((current) => ({
                            ...current,
                            tags: event.target.value,
                          }))
                        }
                        placeholder="work, communication"
                        className="rounded-xl"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addMemory}
                      disabled={
                        addingMemory ||
                        !memoryDraft.title.trim() ||
                        !memoryDraft.content.trim() ||
                        memories.length >= 200
                      }
                      className="rounded-xl"
                    >
                      <Plus size={15} />
                      {addingMemory ? "Remembering…" : "Add memory"}
                    </Button>
                  </div>
                </div>

                {memories.length ? (
                  <div className="divide-y rounded-xl border">
                    {memories.map((memory) => (
                      <article
                        key={memory.id}
                        className="group flex gap-3 p-4 transition-colors hover:bg-muted/25"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-medium">
                              {memory.title}
                            </h3>
                            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium capitalize text-violet-700 dark:text-violet-300">
                              {memory.category}
                            </span>
                            {memory.source === "auto-extracted" ? (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                Learned in chat
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {memory.content}
                          </p>
                          {memory.tags.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {memory.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="font-mono text-[10px] text-muted-foreground"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Forget ${memory.title}`}
                          title={`Forget ${memory.title}`}
                          onClick={() => setDeleteTarget(memory)}
                          className="size-8 shrink-0 rounded-full text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed py-10 text-center">
                    <Brain
                      size={22}
                      className="mx-auto mb-3 text-muted-foreground"
                    />
                    <p className="text-sm font-medium">No saved memories yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add one above or tell your agent what to remember in chat.
                    </p>
                  </div>
                )}
              </div>
              )}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="glass overflow-hidden rounded-3xl">
              <div className="border-b bg-gradient-to-br from-primary/10 via-transparent to-violet-500/10 p-5">
                <div className="flex items-center gap-3">
                  <span className="relative flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-400 text-white">
                    <MessageCircleMore size={20} />
                    <span className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-card bg-emerald-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {settings.agentName.trim() || "Unnamed agent"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedMood.label} ·{" "}
                      {lengthDetails[settings.responseLength].label}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Voice preview
                </p>
                <div className="mt-3 rounded-2xl rounded-tl-sm bg-muted/70 p-4 text-sm leading-6">
                  {selectedMood.sample}
                  {settings.responseLength === "detailed"
                    ? " I’ll include the reasoning, tradeoffs, and a concrete example so the next step is easy to choose."
                    : settings.responseLength === "balanced"
                      ? " I’ll add the context that helps you make the next decision."
                      : ""}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <Check size={11} />
                  </span>
                  {memories.length
                    ? `${memories.length} ${memories.length === 1 ? "memory" : "memories"} available`
                    : "Ready to learn what matters"}
                </div>
              </div>
            </div>

            <div className="content-surface rounded-3xl p-5 text-sm">
              <p className="font-medium">How it works</p>
              <ol className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-mono text-primary">01</span>
                  Voice settings guide how answers are written.
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-primary">02</span>
                  Memories provide private context when it is relevant.
                </li>
                <li className="flex gap-2">
                  <span className="font-mono text-primary">03</span>
                  Company knowledge still controls company-specific answers.
                </li>
              </ol>
            </div>
          </aside>
        </div>
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.title}” will no longer be available in future chats.`
                : "This memory will no longer be available in future chats."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteMemory();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Forgetting…" : "Forget memory"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
