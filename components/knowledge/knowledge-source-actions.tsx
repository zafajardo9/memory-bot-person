"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

export function KnowledgeSourceActions({
  sourceId,
  sourceType,
  sourceStatus,
  initialContent,
}: {
  sourceId: string;
  sourceType: string;
  sourceStatus?: string;
  initialContent?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const retryScan = async () => {
    setPending(true);
    try {
      const response = await fetch(`/api/knowledge/${sourceId}/rescan`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Retry failed");
      toast.success("Scan retried. The source is being re-crawled.");
      router.push("/knowledge");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setPending(false);
    }
  };

  if (sourceType === "NOTE") {
    const updateNote = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPending(true);
      const form = new FormData(event.currentTarget);
      try {
        const response = await fetch(`/api/knowledge/${sourceId}/rescan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: form.get("content") }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Update failed");
        toast.success("Note updated. A new version is being learned.");
        router.push("/knowledge");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Update failed");
      } finally {
        setPending(false);
      }
    };

    return (
      <form onSubmit={updateNote} className="content-surface flex flex-col gap-3 rounded-2xl p-5">
        <div><h2 className="font-medium">Edit note</h2><p className="text-xs text-muted-foreground">Saving creates a new reviewable version. The currently trusted version remains active.</p></div>
        <Textarea name="content" defaultValue={initialContent} className="min-h-56 leading-6" required />
        <div className="flex items-center justify-between gap-2">
          {sourceStatus === "FAILED" ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={retryScan} disabled={pending}>
              <RefreshCw size={13} /> Retry scan
            </Button>
          ) : <span />}
          <Button type="submit" disabled={pending} className="self-end">{pending ? "Saving…" : "Save new version"}</Button>
        </div>
      </form>
    );
  }

  // URL sources: show retry button when failed, otherwise nothing extra
  if (sourceType === "URL") {
    return (
      <div className="content-surface flex flex-col gap-3 rounded-2xl p-5">
        <div>
          <h2 className="font-medium">Source actions</h2>
          <p className="text-xs text-muted-foreground">
            {sourceStatus === "FAILED"
              ? "The last scan failed. Retry to re-crawl this URL and its linked pages."
              : "URL sources are re-crawled on retry. No manual content editing is available."}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={retryScan} disabled={pending}>
          <RefreshCw size={13} /> {pending ? "Retrying…" : sourceStatus === "FAILED" ? "Retry scan" : "Re-crawl source"}
        </Button>
      </div>
    );
  }

  if (sourceType !== "FILE") return null;

  const replaceFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch(`/api/knowledge/${sourceId}/rescan`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Replacement failed");
      event.currentTarget.reset();
      toast.success("Replacement uploaded. A new version is being scanned.");
      router.push("/knowledge");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Replacement failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={replaceFile} className="content-surface flex flex-col gap-3 rounded-2xl p-5">
      <div>
        <h2 className="font-medium">Replace file</h2>
        <p className="text-xs text-muted-foreground">
          Creates a new immutable version. The current approved version remains active until approval.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="file"
          type="file"
          accept=".md,.txt,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
        />
        <Button type="submit" disabled={pending}>{pending ? "Uploading…" : "Replace and scan"}</Button>
      </div>
    </form>
  );
}
