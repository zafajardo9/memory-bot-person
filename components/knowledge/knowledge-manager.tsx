"use client";

import {
  ArrowRight,
  AlertCircle,
  Bold,
  BookOpen,
  CheckCircle2,
  Code2,
  Database,
  FileText,
  Globe2,
  Heading2,
  Italic,
  Library,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  NotebookPen,
  Plus,
  Quote,
  Redo2,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import TurndownService from "turndown";

import { fetcher } from "@/lib/utils";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface VersionSummary {
  id: string;
  version: number;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  _count: { chunks: number };
}

interface SourceSummary {
  id: string;
  title: string;
  type: "NOTE" | "FILE" | "URL";
  status: string;
  canonicalUrl?: string | null;
  tags: string[];
  updatedAt: string;
  createdById: string;
  createdBy: { id: string; email: string };
  versions: VersionSummary[];
  jobs: Array<{
    id: string;
    status: string;
    stage: string;
    progress: number;
    errorMessage?: string | null;
  }>;
}

interface KnowledgeUsage {
  sources: { used: number; limit: number };
  contextTokens: { used: number; limit: number };
  passages: number;
}

type ComposerTab = "NOTE" | "FILE" | "URL";

async function mutateSource(url: string, init: RequestInit = {}) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Memory operation failed");
  return body;
}

const typeMeta = {
  NOTE: {
    label: "Note",
    action: "Write a note",
    description: "Capture decisions, processes, and shared context in a rich document.",
    icon: NotebookPen,
    color: "border bg-background text-primary",
  },
  FILE: {
    label: "File",
    action: "Upload a file",
    description: "Add a PDF, DOCX, Markdown, or text document for Memory to learn.",
    icon: FileText,
    color: "border bg-background text-primary",
  },
  URL: {
    label: "Link",
    action: "Import a link",
    description: "Save trusted public documentation and choose how deeply to scan it.",
    icon: Globe2,
    color: "border bg-background text-primary",
  },
};

function statusLabel(status: string) {
  if (status === "APPROVED") return "Trusted";
  if (status === "PROCESSING") return "Learning";
  if (status === "DRAFT") return "Needs review";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function KnowledgeManager({
  isAdmin,
  currentUserId,
  agentId,
  agentName,
}: {
  isAdmin: boolean;
  currentUserId: string;
  agentId: string;
  agentName: string;
}) {
  const { data, error, isLoading, mutate } = useSWR<{
    sources: SourceSummary[];
    usage: KnowledgeUsage;
  }>(`/api/knowledge?agentId=${encodeURIComponent(agentId)}`, fetcher, {
    refreshInterval: 3_000,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ComposerTab>("NOTE");
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const turndown = useRef(
    new TurndownService({ headingStyle: "atx", bulletListMarker: "-" }),
  );

  const sources = useMemo(() => data?.sources ?? [], [data?.sources]);
  const usage = data?.usage;
  const isAtCapacity = Boolean(
    usage &&
      (usage.sources.used >= usage.sources.limit ||
        usage.contextTokens.used >= usage.contextTokens.limit),
  );
  const filteredSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sources.filter((source) => {
      const matchesStatus =
        statusFilter === "ALL" || source.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        source.title.toLowerCase().includes(normalizedQuery) ||
        source.tags.some((tag) =>
          tag.toLowerCase().includes(normalizedQuery),
        ) ||
        source.createdBy.email.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [query, sources, statusFilter]);

  const openComposer = (nextTab: ComposerTab) => {
    if (isAtCapacity) {
      toast.error(
        "Knowledge capacity is full. Archive or delete a source before adding more.",
      );
      return;
    }
    setTab(nextTab);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    if (!isSubmitting) setComposerOpen(false);
  };

  const submitNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const content = turndown.current
      .turndown(noteEditorRef.current?.innerHTML ?? "")
      .trim();

    if (content.length < 10) {
      toast.error("Write at least a short paragraph before saving your note.");
      return;
    }

    setIsSubmitting(true);
    try {
      await mutateSource("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "NOTE",
          agentId,
          title: form.get("title"),
          content,
          tags: String(form.get("tags") ?? "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      formElement.reset();
      if (noteEditorRef.current) noteEditorRef.current.innerHTML = "";
      setComposerOpen(false);
      toast.success(`Note added to ${agentName}’s notebook and queued for learning.`);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setIsSubmitting(true);
    try {
      const upload = new FormData(formElement);
      upload.set("agentId", agentId);
      await mutateSource("/api/knowledge", {
        method: "POST",
        body: upload,
      });
      formElement.reset();
      setSelectedFileName("");
      setComposerOpen(false);
      toast.success(`File added to ${agentName}’s notebook. Deep scan started.`);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setIsSubmitting(true);
    try {
      await mutateSource("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          title: form.get("title"),
          url: form.get("url"),
          tags: String(form.get("tags") ?? "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          crawlDepth: Number(form.get("crawlDepth") ?? 0),
          crawlLimit: Number(form.get("crawlLimit") ?? 1),
        }),
      });
      formElement.reset();
      setComposerOpen(false);
      toast.success("Link added. Deep scan started.");
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Link import failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const runAction = async (
    label: string,
    url: string,
    init: RequestInit = {},
  ) => {
    try {
      await mutateSource(url, init);
      toast.success(label);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const trustedCount = sources.filter(
    (source) => source.status === "APPROVED",
  ).length;
  const learningCount = sources.filter(
    (source) => source.status === "PROCESSING",
  ).length;
  const reviewCount = sources.filter(
    (source) => source.status === "DRAFT",
  ).length;

  return (
    <main className="min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none fixed inset-x-0 top-16 -z-0 h-72 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.09),transparent_62%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-20 pt-24 sm:px-6 lg:pt-28">
        <header className="grid gap-7 border-b pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="flex items-start gap-4">
            <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
              <Library size={20} />
            </span>
            <div className="max-w-2xl">
              <p className="eyebrow">{agentName} · dedicated notebook</p>
              <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Knowledge workspace
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Give {agentName} the sources it should know. This notebook view is
                isolated from your other agents.
              </p>
            </div>
          </div>
          <Button
            size="lg"
            className="w-full gap-2 shadow-sm sm:w-fit"
            onClick={() => openComposer("NOTE")}
            disabled={isAtCapacity}
          >
            <Plus size={17} /> Add knowledge
          </Button>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section
            aria-label="Notebook overview"
            className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card shadow-sm sm:grid-cols-4"
          >
            <Stat value={sources.length} label="All sources" icon={BookOpen} />
            <Stat value={trustedCount} label="Trusted" icon={ShieldCheck} />
            <Stat value={learningCount} label="Learning" icon={LoaderCircle} />
            <Stat value={reviewCount} label="Needs review" icon={AlertCircle} />
          </section>
          <KnowledgeCapacity usage={usage} isLoading={isLoading} />
        </div>

        <section aria-labelledby="create-memory-heading">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="eyebrow">Ways to add knowledge</p>
              <h2 id="create-memory-heading" className="mt-1 text-lg font-semibold">
                Start with a source
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Capture something new or bring in a source your team already uses.
              </p>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Available only to {agentName}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(["NOTE", "FILE", "URL"] as ComposerTab[]).map((item) => {
              const meta = typeMeta[item];
              const Icon = meta.icon;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => openComposer(item)}
                  disabled={isAtCapacity}
                  className="group relative rounded-xl border bg-card p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm sm:p-5"
                >
                  <div className="relative z-10 flex items-start gap-4">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-md ${meta.color}`}
                    >
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3 font-semibold">
                        {meta.action}
                        <ArrowRight
                          size={16}
                          className="text-muted-foreground transition duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
                        />
                      </span>
                      <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Source library</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                {agentName}’s notebook
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Browse and manage the sources this agent can reference.
              </p>
            </div>
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:w-auto">
              <div className="relative min-w-0 sm:w-72">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={15}
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search sources…"
                  className="pl-9"
                />
              </div>
              <select
                aria-label="Filter sources by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 max-w-36 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:max-w-none"
              >
                <option value="ALL">All</option>
                <option value="APPROVED">Trusted</option>
                <option value="DRAFT">Needs review</option>
                <option value="PROCESSING">Learning</option>
                <option value="FAILED">Failed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-28 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          ) : null}
          {!isLoading && error && !data ? (
            <div className="flex flex-col items-start gap-4 rounded-xl border border-destructive/25 bg-destructive/5 p-5 sm:flex-row sm:items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">The notebook could not be loaded</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Check your connection and try loading the sources again.
                </p>
              </div>
              <Button variant="outline" onClick={() => void mutate()}>
                Try again
              </Button>
            </div>
          ) : null}
          {!isLoading && data && filteredSources.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-5 py-12 text-center sm:p-14">
              <BookOpen className="mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">No memories found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another search or add the first note.
              </p>
              <Button className="mt-5 gap-2" onClick={() => openComposer("NOTE")}>
                <Plus size={15} /> Write a note
              </Button>
            </div>
          ) : null}
          <div className="space-y-3" aria-live="polite">
            {filteredSources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                runAction={runAction}
              />
            ))}
          </div>
        </section>
      </div>

      <Dialog
        open={composerOpen}
        onOpenChange={(open) => {
          if (!open) closeComposer();
          else setComposerOpen(true);
        }}
      >
        <DialogContent className="flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] max-w-6xl flex-col sm:h-auto">
          <div className="shrink-0 border-b bg-muted/35 px-5 pb-4 pt-5 sm:px-7">
            <DialogHeader className="pr-12">
              <DialogTitle>Add to the notebook</DialogTitle>
              <DialogDescription>
                Create a trusted source for your team. You can review and publish it
                after Memory finishes learning.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 inline-grid grid-cols-3 rounded-lg border bg-background p-1">
              {(["NOTE", "FILE", "URL"] as ComposerTab[]).map((item) => {
                const Icon = typeMeta[item].icon;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition duration-150 ${
                      tab === item
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon size={15} /> {typeMeta[item].label}
                  </button>
                );
              })}
            </div>
          </div>

          {tab === "NOTE" ? (
            <form onSubmit={submitNote} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-4xl px-5 py-7 sm:p-10">
                  <Input
                    name="title"
                    placeholder="Untitled note"
                    aria-label="Note title"
                    className="h-auto border-0 bg-transparent px-0 text-3xl font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/45 focus-visible:ring-0 sm:text-4xl"
                    required
                  />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Capture context clearly. Formatting is preserved as Markdown for
                    reliable AI retrieval.
                  </p>
                  <div className="sticky top-0 z-10 -mx-2 mt-6 flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1.5">
                    <EditorToolbar editorRef={noteEditorRef} />
                  </div>
                  <div
                    ref={noteEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Note content"
                    aria-multiline="true"
                    data-placeholder="Start writing… Type a process, decision, policy, or anything your team should remember."
                    className="mt-5 min-h-[38vh] rounded-xl text-base leading-7 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground/50 empty:before:content-[attr(data-placeholder)] [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_h2]:mb-2 [&_h2]:mt-7 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-7 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100 [&_ul]:list-disc [&_ul]:pl-7 p-2"
                  />
                </div>
              </div>
              <ComposerFooter
                isAdmin={isAdmin}
                isSubmitting={isSubmitting}
                topics={
                  <Field label="Topics" hint="Separate with commas" compact>
                  <Input
                    name="tags"
                    placeholder="operations, planning, onboarding"
                    className="sm:w-80"
                  />
                  </Field>
                }
                action={
                  <Button type="submit" disabled={isSubmitting} className="gap-2">
                  <NotebookPen size={16} />
                  {isSubmitting ? "Saving…" : "Save note"}
                  </Button>
                }
              />
            </form>
          ) : null}

          {tab === "FILE" ? (
            <form onSubmit={submitFile} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto grid max-w-5xl gap-8 px-5 py-8 md:grid-cols-[1.2fr_0.8fr] sm:px-8 sm:py-10">
                <label className="group flex min-h-80 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-8 text-center transition-colors hover:border-primary/45 hover:bg-muted/60">
                  <span className="flex size-14 items-center justify-center rounded-lg border bg-card text-primary">
                    <UploadCloud size={28} />
                  </span>
                  <span className="mt-5 text-lg font-semibold">
                    {selectedFileName || "Choose a document"}
                  </span>
                  <span className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    PDF, DOCX, Markdown, or plain text up to 8 MB. Memory extracts,
                    structures, and indexes the content.
                  </span>
                  <span className="mt-5 rounded-md border bg-background px-4 py-2 text-sm font-medium">
                    Browse files
                  </span>
                  <input
                    name="file"
                    type="file"
                    accept=".md,.txt,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    onChange={(event) =>
                      setSelectedFileName(event.target.files?.[0]?.name ?? "")
                    }
                    required
                  />
                </label>
                <div className="flex flex-col justify-center gap-5">
                  <div>
                    <span className="inline-flex size-10 items-center justify-center rounded-md border bg-background text-primary">
                      <FileText size={19} />
                    </span>
                    <h3 className="mt-4 text-2xl font-semibold">Describe this file</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      A clear title and topics help teammates find this source later.
                    </p>
                  </div>
                  <Field label="Title">
                    <Input name="title" placeholder="e.g. Employee handbook" required />
                  </Field>
                  <Field label="Topics" hint="Separate with commas">
                    <Input name="tags" placeholder="people, policy, benefits" />
                  </Field>
                  {!isAdmin ? <ReviewNotice /> : null}
                  <div className="flex justify-end gap-2 pt-2">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" disabled={isSubmitting}>
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting} className="gap-2">
                      <UploadCloud size={16} />
                      {isSubmitting ? "Uploading…" : "Upload and learn"}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          ) : null}

          {tab === "URL" ? (
            <form onSubmit={submitUrl} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
                <div className="text-center">
                  <span className="mx-auto flex size-14 items-center justify-center rounded-lg border bg-background text-primary">
                    <Globe2 size={28} />
                  </span>
                  <h3 className="mt-5 text-3xl font-semibold tracking-tight">
                    Import knowledge from the web
                  </h3>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Add trusted public documentation. Memory follows safe,
                    same-origin links within the limits you choose.
                  </p>
                </div>
                <div className="mt-8 rounded-xl border bg-card p-5 sm:p-7">
                  <Field label="Public link">
                    <div className="relative">
                      <Link2
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        name="url"
                        type="url"
                        placeholder="https://company.example/docs"
                        className="h-14 pl-11 text-base"
                        required
                      />
                    </div>
                  </Field>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Title">
                      <Input
                        name="title"
                        placeholder="e.g. Product documentation"
                        required
                      />
                    </Field>
                    <Field label="Topics" hint="Separate with commas">
                      <Input name="tags" placeholder="product, engineering" />
                    </Field>
                  </div>
                  <div className="mt-5 rounded-2xl bg-muted/60 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Scan settings
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Crawl depth" hint="0–2 links deep">
                        <Input
                          name="crawlDepth"
                          type="number"
                          min="0"
                          max="2"
                          defaultValue="0"
                        />
                      </Field>
                      <Field label="Page limit" hint="Maximum 20 pages">
                        <Input
                          name="crawlLimit"
                          type="number"
                          min="1"
                          max="20"
                          defaultValue="1"
                        />
                      </Field>
                    </div>
                  </div>
                  {!isAdmin ? <ReviewNotice /> : null}
                  <DialogFooter className="mt-6">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" disabled={isSubmitting}>
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting} className="gap-2">
                      <Globe2 size={16} />
                      {isSubmitting ? "Scanning…" : "Save and scan"}
                    </Button>
                  </DialogFooter>
                </div>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function EditorToolbar({
  editorRef,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
  };

  const createLink = () => {
    const url = window.prompt("Paste a link URL");
    if (url) command("createLink", url);
  };

  return (
    <>
      <ToolbarButton label="Undo" icon={Undo2} onClick={() => command("undo")} />
      <ToolbarButton label="Redo" icon={Redo2} onClick={() => command("redo")} />
      <ToolbarDivider />
      <ToolbarButton
        label="Heading"
        icon={Heading2}
        onClick={() => command("formatBlock", "h2")}
      />
      <ToolbarButton label="Bold" icon={Bold} onClick={() => command("bold")} />
      <ToolbarButton
        label="Italic"
        icon={Italic}
        onClick={() => command("italic")}
      />
      <ToolbarDivider />
      <ToolbarButton
        label="Bulleted list"
        icon={List}
        onClick={() => command("insertUnorderedList")}
      />
      <ToolbarButton
        label="Numbered list"
        icon={ListOrdered}
        onClick={() => command("insertOrderedList")}
      />
      <ToolbarButton
        label="Quote"
        icon={Quote}
        onClick={() => command("formatBlock", "blockquote")}
      />
      <ToolbarButton
        label="Code block"
        icon={Code2}
        onClick={() => command("formatBlock", "pre")}
      />
      <ToolbarButton label="Link" icon={Link2} onClick={createLink} />
    </>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Bold;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition duration-100 hover:bg-muted hover:text-foreground active:scale-95"
    >
      <Icon size={16} />
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;
}

function ComposerFooter({
  isAdmin,
  isSubmitting,
  topics,
  action,
}: {
  isAdmin: boolean;
  isSubmitting: boolean;
  topics: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="shrink-0 border-t bg-muted/35 px-5 py-4 sm:px-7">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">{topics}</div>
        <div className="flex items-center justify-end gap-2">
          {!isAdmin ? (
            <span className="mr-2 hidden max-w-52 text-right text-[11px] leading-4 text-amber-700 dark:text-amber-300 lg:block">
              An admin publishes this before AI trusts it.
            </span>
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          {action}
        </div>
      </div>
    </div>
  );
}

function ReviewNotice() {
  return (
    <p className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:text-amber-200">
      An admin will review and publish this before AI treats it as trusted company
      truth.
    </p>
  );
}

function SourceCard({
  source,
  isAdmin,
  currentUserId,
  runAction,
}: {
  source: SourceSummary;
  isAdmin: boolean;
  currentUserId: string;
  runAction: (label: string, url: string, init?: RequestInit) => Promise<void>;
}) {
  const meta = typeMeta[source.type];
  const Icon = meta.icon;
  const latest = source.versions[0];
  const job = source.jobs[0];
  const readyVersion = source.versions.find(
    (version) => version.status === "READY",
  );
  const canManage = isAdmin || source.createdById === currentUserId;

  return (
    <article className="group flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-md sm:flex-row sm:items-center sm:p-5">
      <div className="flex items-center justify-between gap-3 sm:self-start">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${meta.color}`}
        >
          <Icon size={18} />
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:hidden ${
            source.status === "APPROVED"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : source.status === "PROCESSING"
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          {source.status === "APPROVED" ? <CheckCircle2 size={12} /> : null}
          {statusLabel(source.status)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={`/knowledge/${source.id}`}
          className="line-clamp-2 font-semibold leading-5 transition-colors group-hover:text-primary"
        >
          {source.title}
        </Link>
        <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
          {meta.label} · By {source.createdBy.email.split("@")[0]} · v
          {latest?.version ?? 1} · {latest?._count.chunks ?? 0} passages
        </p>
        <div className="mt-3 flex min-h-6 flex-wrap items-center gap-1.5">
          {source.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
          {source.tags.length > 4 ? (
            <span className="text-[10px] text-muted-foreground">
              +{source.tags.length - 4} more
            </span>
          ) : null}
        </div>

        {job && ["QUEUED", "PROCESSING"].includes(job.status) ? (
          <div className="mt-3 max-w-md">
            <div className="mb-1 flex justify-between text-[10px] capitalize text-muted-foreground">
              <span>{job.stage.replaceAll("_", " ")}</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        ) : null}
        {job?.errorMessage || latest?.errorMessage ? (
          <p className="mt-2 text-xs text-destructive">
            {job?.errorMessage ?? latest?.errorMessage}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t pt-3 sm:w-36 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
        <span
          className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${
            source.status === "APPROVED"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : source.status === "PROCESSING"
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          {source.status === "APPROVED" ? <CheckCircle2 size={12} /> : null}
          {statusLabel(source.status)}
        </span>

        {(readyVersion && isAdmin) || canManage ? (
          <div className="flex w-full items-center justify-end gap-2 sm:mt-auto">
            {readyVersion && isAdmin ? (
              <Button
                size="sm"
                className="h-8 flex-1 gap-1.5 sm:flex-none"
                onClick={() =>
                  runAction(
                    "Memory published as trusted",
                    `/api/knowledge/${source.id}/approve`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ versionId: readyVersion.id }),
                    },
                  )
                }
              >
                <ShieldCheck size={13} /> Publish
              </Button>
            ) : null}
            {canManage ? (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${source.title}`}
                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (window.confirm(`Delete ${source.title}?`)) {
                    void runAction(
                      "Memory deleted",
                      `/api/knowledge/${source.id}`,
                      { method: "DELETE" },
                    );
                  }
                }}
              >
                <Trash2 size={14} />
              </Button>
            ) : null}
          </div>
        ) : (
          <Link
            href={`/knowledge/${source.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            View source
          </Link>
        )}
      </div>
    </article>
  );
}

function Field({
  label,
  hint,
  children,
  compact = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {hint ? (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Stat({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: typeof Library;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-r p-4 [&:nth-child(2)]:border-r-0 [&:nth-child(n+3)]:border-b-0 sm:border-b-0 sm:px-5 sm:[&:nth-child(2)]:border-r sm:last:border-r-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <div className="font-mono text-xl font-semibold leading-none tabular-nums">
          {value}
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function KnowledgeCapacity({
  usage,
  isLoading,
}: {
  usage?: KnowledgeUsage;
  isLoading: boolean;
}) {
  if (isLoading || !usage) {
    return (
      <div className="h-36 animate-pulse rounded-xl border bg-muted" aria-label="Loading knowledge capacity" />
    );
  }

  const percentage = Math.min(
    100,
    Math.round(
      (usage.contextTokens.used / usage.contextTokens.limit) * 100,
    ),
  );
  const circumference = 263.89;
  const dashOffset = circumference * (1 - percentage / 100);
  const isFull = percentage >= 100;
  const isNearLimit = percentage >= 80;
  const isSourceFull = usage.sources.used >= usage.sources.limit;
  const progressColor = isFull
    ? "stroke-destructive"
    : isNearLimit
      ? "stroke-amber-500"
      : "stroke-primary";

  return (
    <aside className="rounded-xl border bg-card p-4 shadow-sm" aria-labelledby="knowledge-capacity-heading">
      <div className="flex items-center gap-4">
        <div className="relative size-24 shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="size-full -rotate-90"
            role="progressbar"
            aria-label="Indexed context used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="8"
              className="stroke-muted"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={`${progressColor} transition-[stroke-dashoffset] duration-500`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-semibold tabular-nums">
              {percentage}%
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              used
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-primary" />
            <h2 id="knowledge-capacity-heading" className="text-sm font-semibold">
              Context capacity
            </h2>
          </div>
          <p className="mt-2 font-mono text-sm tabular-nums">
            {compactNumber(usage.contextTokens.used)}
            <span className="text-muted-foreground">
              {" "}/ {compactNumber(usage.contextTokens.limit)} tokens
            </span>
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Indexed text available for trusted retrieval.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 divide-x border-t pt-3 text-xs">
        <div className="pr-3">
          <span className="block font-mono font-medium tabular-nums">
            {usage.sources.used.toLocaleString()} / {usage.sources.limit.toLocaleString()}
          </span>
          <span className="mt-0.5 block text-muted-foreground">Active sources</span>
        </div>
        <div className="pl-3">
          <span className="block font-mono font-medium tabular-nums">
            {usage.passages.toLocaleString()}
          </span>
          <span className="mt-0.5 block text-muted-foreground">Indexed passages</span>
        </div>
      </div>

      {isNearLimit || isSourceFull ? (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ${
            isFull || isSourceFull
              ? "bg-destructive/10 text-destructive"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }`}
        >
          {isFull || isSourceFull
            ? `The ${isSourceFull ? "source" : "context"} limit is full. Archive or delete knowledge before adding more.`
            : "Context capacity is running low. Larger sources may not fit."}
        </p>
      ) : null}
    </aside>
  );
}
