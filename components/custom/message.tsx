"use client";

import {
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { Check, Copy, Paperclip, ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AssistantActivity } from "./assistant-activity";
import { ChatMarkdown } from "./chat-markdown";
import { FollowUpQuestions } from "./follow-up-questions";
import { BotIcon, UserIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";

export const Message = ({
  chatId,
  message,
  agentName,
  isActive = false,
  onSelectFollowUp,
  showFollowUps = false,
  userMessage,
}: {
  chatId: string;
  message: UIMessage;
  agentName: string;
  isActive?: boolean;
  onSelectFollowUp: (question: string) => Promise<void>;
  showFollowUps?: boolean;
  userMessage: string;
}) => {
  const { role } = message;
  const content = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
  const reasoning = message.parts.filter(isReasoningUIPart);
  const toolInvocations = message.parts.filter(isToolUIPart);
  const attachments = message.parts.filter(isFileUIPart);
  const sources = message.parts.filter((part) => part.type === "source-url");
  const isAssistant = role === "assistant";
  const showAnswer = isAssistant && Boolean(content);

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<1 | -1 | null>(null);

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

  const copyButton = (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      aria-label={copied ? "Copied" : "Copy message"}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );

  return (
    <article
      className="flex w-full max-w-3xl flex-row gap-3 px-4 first-of-type:pt-24 sm:gap-4 sm:px-0"
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
        {!isAssistant && attachments.length > 0 ? (
          <div className="rounded-xl border bg-muted/45 p-2.5">
            <div className="mb-2 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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

        {!isAssistant && content ? (
          <div className="relative flex flex-col gap-3 rounded-xl border bg-muted px-4 py-2.5 leading-6 text-foreground before:absolute before:left-[-5px] before:top-[14px] before:size-2 before:rotate-45 before:border-b before:border-l before:border-border before:bg-muted">
            <ChatMarkdown>{content}</ChatMarkdown>
          </div>
        ) : null}

        {isAssistant ? (
          <AssistantActivity
            chatId={chatId}
            reasoning={reasoning}
            tools={toolInvocations}
            sources={sources}
            isActive={isActive}
          />
        ) : null}

        {showAnswer ? (
          <section
            aria-label="Assistant answer"
            className={
              reasoning.length > 0 ||
              toolInvocations.length > 0 ||
              sources.length > 0
                ? "border-t pt-3"
                : ""
            }
          >
            {reasoning.length > 0 ||
            toolInvocations.length > 0 ||
            sources.length > 0 ? (
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Answer
              </div>
            ) : null}
            <div className="min-w-0 text-foreground">
              <ChatMarkdown streaming={isActive}>{content}</ChatMarkdown>
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
            {queryLogId && !isActive ? (
              <>
                <button
                  type="button"
                  onClick={() => handleFeedback(1)}
                  disabled={feedback !== null}
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] transition-colors ${
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
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] transition-colors ${
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

        {!isAssistant && content ? copyButton : null}
      </div>
    </article>
  );
};
