"use client";

import { Command, LoaderCircle, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

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
import { normalizeSkillSlug, SKILL_LIMITS } from "@/lib/skills";
import { fetcher } from "@/lib/utils";

interface UserSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  enabled: boolean;
  usageCount: number;
}

interface SkillsResponse {
  enabled: boolean;
  skills: UserSkill[];
}

const emptyDraft = {
  name: "",
  slug: "",
  description: "",
  instructions: "",
  enabled: true,
};

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return body?.error ?? fallback;
}

export function SkillManager() {
  const { data, error, isLoading, mutate } = useSWR<SkillsResponse>(
    "/api/ai/skills",
    fetcher,
    { revalidateOnFocus: false },
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserSkill | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserSkill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const skills = data?.skills ?? [];

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setSlugEdited(false);
    setDialogOpen(true);
  };

  const openEdit = (skill: UserSkill) => {
    setEditing(skill);
    setDraft({
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      instructions: skill.instructions,
      enabled: skill.enabled,
    });
    setSlugEdited(true);
    setDialogOpen(true);
  };

  const saveSkill = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        editing ? `/api/ai/skills/${editing.id}` : "/api/ai/skills",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      if (!response.ok) {
        throw new Error(await responseError(response, "Unable to save skill."));
      }
      await mutate();
      setDialogOpen(false);
      toast.success(editing ? "Skill updated." : "Skill ready to call in chat.");
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Unable to save skill.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = async (skill: UserSkill) => {
    try {
      const response = await fetch(`/api/ai/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !skill.enabled }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Unable to update skill."));
      }
      await mutate();
      toast.success(skill.enabled ? "Skill disabled." : "Skill enabled.");
    } catch (toggleError) {
      toast.error(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update skill.",
      );
    }
  };

  const deleteSkill = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/ai/skills/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "Unable to delete skill."));
      }
      await mutate();
      setDeleteTarget(null);
      toast.success("Skill deleted.");
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete skill.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="font-semibold">Reusable chat skills</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Save instructions once, then type their slash command at the start of
            a message. Skills apply to one turn and remain private to you.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={openCreate}
          disabled={skills.length >= SKILL_LIMITS.maxPerUser}
          className="w-fit rounded-xl"
        >
          <Plus size={14} />
          New skill
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-primary/[0.055] px-4 py-3 text-xs text-muted-foreground">
        <span>
          Call a skill with <code className="font-mono text-primary">/command your request</code>
        </span>
        <span className="shrink-0 font-mono">
          {skills.length}/{SKILL_LIMITS.maxPerUser}
        </span>
      </div>

      {data && !data.enabled ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Chat skill invocation is temporarily disabled for this workspace.
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <LoaderCircle size={16} className="animate-spin" />
          Loading skills…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-5 text-sm text-destructive">
          Skills could not be loaded. Refresh and try again.
        </div>
      ) : skills.length ? (
        <div className="space-y-2">
          {skills.map((skill) => (
            <article
              key={skill.id}
              className={`group flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                skill.enabled
                  ? "border-border/80 bg-background/35"
                  : "border-border/50 bg-foreground/[0.02] opacity-65"
              }`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
                <Command size={17} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="font-medium">{skill.name}</h3>
                  <span className="font-mono text-xs text-primary/80">/{skill.slug}</span>
                  {!skill.enabled ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      Disabled
                    </span>
                  ) : null}
                </div>
                {skill.description ? (
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {skill.description}
                  </p>
                ) : null}
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground/80">
                  {skill.instructions}
                </p>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
                  Used {skill.usageCount} {skill.usageCount === 1 ? "time" : "times"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-full"
                  onClick={() => void toggleSkill(skill)}
                  aria-label={skill.enabled ? `Disable ${skill.name}` : `Enable ${skill.name}`}
                  title={skill.enabled ? "Disable skill" : "Enable skill"}
                >
                  <Power size={14} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-full"
                  onClick={() => openEdit(skill)}
                  aria-label={`Edit ${skill.name}`}
                  title="Edit skill"
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(skill)}
                  aria-label={`Delete ${skill.name}`}
                  title="Delete skill"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed py-12 text-center">
          <Command size={24} className="mx-auto text-muted-foreground/70" />
          <p className="mt-3 text-sm font-medium">No chat skills yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            Create a reusable instruction such as a concise brief, meeting recap,
            or decision memo.
          </p>
          <Button type="button" size="sm" onClick={openCreate} className="mt-4 rounded-xl">
            <Plus size={14} />
            Create your first skill
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
          <DialogHeader className="border-b px-5 py-6 pr-16 sm:px-7">
            <DialogTitle>{editing ? "Edit skill" : "Create a chat skill"}</DialogTitle>
            <DialogDescription>
              The instructions are applied to one message when you call the slash command.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5 sm:px-7 sm:py-6">
            <div className="space-y-2">
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                maxLength={60}
                value={draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    name,
                    slug: slugEdited ? current.slug : normalizeSkillSlug(name),
                  }));
                }}
                placeholder="Executive brief"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-slug">Slash command</Label>
              <div className="flex items-center rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 font-mono text-sm text-muted-foreground">/</span>
                <input
                  id="skill-slug"
                  value={draft.slug}
                  maxLength={40}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setDraft((current) => ({
                      ...current,
                      slug: event.target.value.toLowerCase(),
                    }));
                  }}
                  className="h-10 min-w-0 flex-1 bg-transparent px-1 pr-3 font-mono text-sm outline-none"
                  placeholder="executive-brief"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-description">Description</Label>
              <Input
                id="skill-description"
                maxLength={200}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Turns a topic into an action-focused leadership brief"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="skill-instructions">Instructions</Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {draft.instructions.length}/{SKILL_LIMITS.maxInstructions}
                </span>
              </div>
              <Textarea
                id="skill-instructions"
                rows={8}
                maxLength={SKILL_LIMITS.maxInstructions}
                value={draft.instructions}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, instructions: event.target.value }))
                }
                placeholder="Start with the decision needed, summarize the evidence in three bullets, then list risks and the next action."
                className="resize-y rounded-xl"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Skills guide presentation and reasoning but cannot override privacy,
                safety, tool, or company-source rules.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t bg-muted/25 px-5 py-4 sm:px-7">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveSkill()}
              disabled={saving || !draft.name.trim() || !draft.slug.trim() || !draft.instructions.trim()}
            >
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : null}
              {saving ? "Saving…" : editing ? "Save changes" : "Create skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this skill?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `/${deleteTarget.slug} will no longer be available in chat.`
                : "This skill will no longer be available in chat."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep skill</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void deleteSkill();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete skill"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
