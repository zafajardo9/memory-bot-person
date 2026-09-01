"use client";

import {
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import {
  Check,
  Command,
  Copy,
  Paperclip,
  Pencil,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { buildCitationRegistry } from "@/lib/ai/citations";

import { AssistantActivity } from "./assistant-activity";
import { ChatMarkdown } from "./chat-markdown";
import { FollowUpQuestions } from "./follow-up-questions";
import { BotIcon, UserIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";

import type { ChatMessageMetadata } from "@/lib/skills";

export const Message = memo(function Message({
  chatId,
  message,
  agentName,
  isActive = false,
  onSelectFollowUp,
  showFollowUps = false,
  userMessage,
  onRegenerate,
  onEditMessage,
}: {
  chatId: string;
  message: UIMessage;
  agentName: string;
  isActive?: boolean;
  onSelectFollowUp: (question: string) => Promise<void>;
  showFollowUps?: boolean;
  userMessage: string;
  onRegenerate?: () => void;
  onEditMessage?: (message: UIMessage, text: string) => void;
}) {
  const { role } = message;
  const content = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
  const reasoning = message.parts.filter(isReasoningUIPart);
  const toolInvocations = message.parts.filter(isToolUIPart);
  const activity = message.parts.filter(
    (part) => isReasoningUIPart(part) || isToolUIPart(part),
  );
  const attachments = message.parts.filter(isFileUIPart);
  const sources = message.parts.filter((part) => part.type === "source-url");
  const isAssistant = role === "assistant";
  const showAnswer = isAssistant && Boolean(content);
  const appliedSkill = isAssistant
    ? (message.metadata as ChatMessageMetadata | undefined)?.appliedSkill
    : undefined;

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<1 | -1 | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");

  // Resolve 【…】 citations in this answer to the evidence cards its
  // knowledge searches produced. Anchors exist only for completed tools.
  const citationRegistry = useMemo(
    () => {
      if (!isAssistant) return undefined;
      const completed = message.parts
        .filter(isToolUIPart)
        .filter((part) => part.state === "output-available")
        .map((part) => part.output);
      return buildCitationRegistry(completed);
    },
    [isAssistant, message],
  );

  // Attribute feedback to the most recent knowledge search in this answer.
  const queryLogId = (() => {
    for (let i = toolInvocations.length - 1; i >= 0; i -= 1) {
      const output = toolInvocations[i].output as
        | { queryLogId?: string }
        | undefined;
      if (output?.queryLogId) return output.queryLogId;
    }
    return null;
  })();

  const handleFeedback = useCallback(
    async (value: 1 | -1) => {
      if (!queryLogId) return;
      setFeedback(value);
      try {
        const response = await fetch("/api/knowledge-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queryLogId, feedback: value }),
        });
        if (!response.ok) throw new Error("feedback failed");
        toast.success(value === 1 ? "Thanks for the feedback" : "Noted — we'll improve this");
      } catch {
        setFeedback(null);
        toast.error("Couldn't save feedback");
      }
    },
    [queryLogId],
  );

  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [content]);

  const startEditing = useCallback(() => {
    setEditDraft(content);
    setIsEditing(true);
  }, [content]);

  const submitEdit = useCallback(() => {
    const nextText = editDraft.trim();
    if (!nextText || !onEditMessage) return;
    setIsEditing(false);
    onEditMessage(message, nextText);
  }, [editDraft, message, onEditMessage]);

  const copyButton = (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-muted-foreground opacity-100 transition-[background-color,color,opacity] hover:bg-foreground/[0.05] hover:text-foreground sm:opacity-0 sm:group-hover/message:opacity-100"
      aria-label={copied ? "Copied" : "Copy message"}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );

  const regenerateButton = onRegenerate ? (
    <button
      type="button"
      onClick={onRegenerate}
      className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-muted-foreground opacity-100 transition-[background-color,color,opacity] hover:bg-foreground/[0.05] hover:text-foreground sm:opacity-0 sm:group-hover/message:opacity-100"
      aria-label="Regenerate answer"
    >
      <RefreshCw size={12} />
      Retry
    </button>
  ) : null;

  return (
    <article
      className="group/message flex w-full max-w-3xl animate-in flex-row gap-3 px-4 fade-in slide-in-from-bottom-1 duration-300 first-of-type:pt-20 sm:gap-4 sm:px-0"
    >
      <div
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
          isAssistant
            ? "text-primary"
            : "text-muted-foreground"
        }`}
      >
        {isAssistant ? <BotIcon /> : <UserIcon />}
      </div>

      <div className="flex min-w-0 w-full flex-col gap-3">
        {isAssistant ? (
          <div className="-mb-1 text-xs font-semibold text-foreground">
            {agentName}
          </div>
        ) : null}
        {appliedSkill ? (
          <div className="-my-1 flex w-fit items-center gap-1.5 rounded-full bg-primary/[0.07] px-2.5 py-1 text-[11px] font-medium text-primary/85">
            <Command size={11} aria-hidden />
            Using skill: {appliedSkill.name}
          </div>
        ) : null}
        {!isAssistant && attachments.length > 0 ? (
          <div className="rounded-2xl bg-foreground/[0.035] p-2.5">
            <div className="mb-2 flex items-center gap-1.5 px-0.5 text-xs font-medium text-muted-foreground">
              <Paperclip size={11} />
              {attachments.length === 1 ? "File shared" : "Files shared"}
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={attachment}
                />
              ))}
            </div>
          </div>
        ) : null}

        {!isAssistant && isEditing ? (
          <div className="flex flex-col gap-2 rounded-[20px] rounded-tr-md border border-primary/30 bg-primary/[0.07] px-4 py-3 dark:bg-primary/[0.12]">
            <textarea
              value={editDraft}
              onChange={(event) => setEditDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsEditing(false);
                } else if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitEdit();
                }
              }}
              rows={Math.min(8, Math.max(2, editDraft.split("\n").length))}
              className="w-full resize-none bg-transparent text-[15px] leading-6 text-foreground outline-none"
              aria-label="Edit your message"
              autoFocus
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Resending replaces the messages after this one
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={!editDraft.trim()}
                  className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Resend
                </button>
              </span>
            </div>
          </div>
        ) : !isAssistant && content ? (
          <div className="flex flex-col gap-3 rounded-[20px] rounded-tr-md bg-primary/[0.07] px-4 py-2.5 leading-6 text-foreground dark:bg-primary/[0.12]">
            <ChatMarkdown>{content}</ChatMarkdown>
          </div>
        ) : null}

        {isAssistant ? (
          <AssistantActivity
            chatId={chatId}
            activity={activity}
            sources={sources}
            isActive={isActive}
          />
        ) : null}

        {showAnswer ? (
          <section
            aria-label="Assistant answer"
            className={reasoning.length > 0 || toolInvocations.length > 0 || sources.length > 0 ? "pt-1" : ""}
          >
            <div className={`min-w-0 text-foreground ${isActive ? "streaming-caret" : ""}`}>
              <ChatMarkdown streaming={isActive} citationRegistry={citationRegistry}>
                {content}
              </ChatMarkdown>
            </div>
          </section>
        ) : null}

        {isAssistant && attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <PreviewAttachment
                key={attachment.url}
                attachment={attachment}
              />
            ))}
          </div>
        ) : null}

        {isAssistant && content ? (
          <div className="flex items-center gap-1">
            {copyButton}
            {regenerateButton}
            {queryLogId && !isActive ? (
              <>
                <button
                  type="button"
                  onClick={() => handleFeedback(1)}
                  disabled={feedback !== null}
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] opacity-100 transition-[background-color,color,opacity] hover:bg-foreground/[0.05] sm:opacity-0 sm:group-hover/message:opacity-100 ${
                    feedback === 1
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  } disabled:cursor-default`}
                  aria-label="Good answer"
                  aria-pressed={feedback === 1}
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback(-1)}
                  disabled={feedback !== null}
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] opacity-100 transition-[background-color,color,opacity] hover:bg-foreground/[0.05] sm:opacity-0 sm:group-hover/message:opacity-100 ${
                    feedback === -1
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  } disabled:cursor-default`}
                  aria-label="Poor answer"
                  aria-pressed={feedback === -1}
                >
                  <ThumbsDown size={12} />
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {showFollowUps && content ? (
          <FollowUpQuestions
            assistantMessage={content}
            messageId={message.id}
            userMessage={userMessage}
            onSelect={onSelectFollowUp}
          />
        ) : null}

        {!isAssistant && content && !isEditing ? (
          <div className="flex items-center gap-1">
            {copyButton}
            {onEditMessage ? (
              <button
                type="button"
                onClick={startEditing}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-muted-foreground opacity-100 transition-[background-color,color,opacity] hover:bg-foreground/[0.05] hover:text-foreground sm:opacity-0 sm:group-hover/message:opacity-100"
                aria-label="Edit and resend message"
              >
                <Pencil size={12} />
                Edit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
});
