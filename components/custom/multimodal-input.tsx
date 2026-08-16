"use client";

import {
  BrainCircuit,
  Clock3,
  Compass,
  FileUp,
  ImagePlus,
  SlidersHorizontal,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  Dispatch,
  SetStateAction,
  ChangeEvent,
} from "react";
import { toast } from "sonner";

import { ChatErrorNotice } from "./chat-error-notice";
import { ArrowUpIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { SkillPicker, type SkillPickerHandle } from "./skill-picker";
import useWindowSize from "./use-window-size";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

import type {
  ChatSubmission,
  ResearchDepth,
  SubmissionMode,
} from "./chat";
import type { ChatRequestOptions, FileUIPart, UIMessage } from "ai";

const suggestedActions = [
  {
    title: "How do we work?",
    label: "Summarize our core processes",
    action: "Based on our company knowledge, summarize how our team works and cite the sources.",
  },
  {
    title: "Help me get started",
    label: "Find onboarding guidance",
    action: "What should a new team member know first? Please use and cite our company knowledge.",
  },
];

export function MultimodalInput({
  input,
  setInput,
  isLoading,
  aiAvailable,
  stop,
  attachments,
  setAttachments,
  messages,
  sendMessage,
  submitMessage,
  queuedMessage,
  clearQueuedMessage,
  thinkingProviderLabel,
  humanizerAvailable,
  humanizerEnabled,
  onHumanizerChange,
  researchDepth,
  onResearchDepthChange,
  agentName,
  agentId,
  chatError,
  clearChatError,
  retryLastMessage,
}: {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  aiAvailable: boolean;
  stop: () => void;
  attachments: FileUIPart[];
  setAttachments: Dispatch<SetStateAction<FileUIPart[]>>;
  messages: UIMessage[];
  sendMessage: (
    message?: { text: string; files?: FileUIPart[] },
    options?: ChatRequestOptions,
  ) => Promise<void>;
  submitMessage: (message: ChatSubmission) => SubmissionMode;
  queuedMessage: ChatSubmission | null;
  clearQueuedMessage: () => void;
  thinkingProviderLabel: string | null;
  humanizerAvailable: boolean;
  humanizerEnabled: boolean;
  onHumanizerChange: (value: boolean) => void;
  researchDepth: ResearchDepth;
  onResearchDepthChange: (value: ResearchDepth) => void;
  agentName: string;
  agentId: string;
  chatError?: Error;
  clearChatError: () => void;
  retryLastMessage: () => Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skillPickerRef = useRef<SkillPickerHandle>(null);
  const { width } = useWindowSize();

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${Math.max(nextHeight, 64)}px`;
      textareaRef.current.style.overflowY =
        textareaRef.current.scrollHeight > 200 ? "auto" : "hidden";
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [input]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    if (!aiAvailable) {
      toast.error("Workspace AI is unavailable. Ask an administrator to configure it.");
      return;
    }
    const text = input.trim();
    if (!text && attachments.length === 0) return;

    const submissionMode = submitMessage({ text, files: attachments });
    if (submissionMode === "blocked") {
      toast.info("Your next message is already queued.");
      return;
    }

    setInput("");

    setAttachments([]);

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [aiAvailable, attachments, input, setAttachments, setInput, submitMessage, width]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/files/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          filename: pathname,
          mediaType: contentType,
          type: "file" as const,
        };
      } else {
        const { error } = await response.json();
        toast.error(error);
      }
    } catch (error) {
      toast.error("Failed to upload file, please try again!");
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
        event.target.value = "";
      }
    },
    [setAttachments],
  );

  return (
    <div className="relative flex w-full flex-col gap-3">
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-2 py-1">
            {suggestedActions.map((suggestedAction) => (
              <button
                key={suggestedAction.title}
                type="button"
                disabled={!aiAvailable}
                onClick={async () => {
                  await sendMessage({ text: suggestedAction.action });
                }}
                className="glass-soft rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-[background-color,color,transform] hover:-translate-y-0.5 hover:bg-primary/[0.08] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none"
              >
                {suggestedAction.title}
              </button>
            ))}
          </div>
        )}

      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        accept="image/jpeg,image/png,application/pdf"
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />
      <input
        type="file"
        className="hidden"
        ref={imageInputRef}
        accept="image/jpeg,image/png"
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <div className="glass overflow-hidden rounded-[26px] border-border/80 transition-[border-color,box-shadow] duration-200 focus-within:border-primary/35 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] motion-reduce:transition-none dark:border-border">
        {chatError ? (
          <ChatErrorNotice
            error={chatError}
            onDismiss={clearChatError}
            onRetry={() => {
              clearChatError();
              void retryLastMessage();
            }}
          />
        ) : null}

        {queuedMessage ? (
          <div
            className="mx-3 mt-3 flex animate-in items-center gap-2 fade-in slide-in-from-bottom-1 rounded-2xl bg-primary/[0.055] px-3 py-2 text-xs text-muted-foreground duration-200"
            role="status"
            aria-label="Message queued to send next"
          >
            <Clock3 size={13} className="shrink-0 text-primary/70" aria-hidden />
            <span className="shrink-0 font-medium text-foreground/75">
              Queued next
            </span>
            <span className="min-w-0 flex-1 truncate opacity-75">
              {queuedMessage.text ||
                `${queuedMessage.files?.length ?? 0} attachment${
                  queuedMessage.files?.length === 1 ? "" : "s"
                }`}
            </span>
            <button
              type="button"
              onClick={clearQueuedMessage}
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Remove queued message"
              title="Remove queued message"
            >
              <X size={13} aria-hidden />
            </button>
          </div>
        ) : null}

        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-1 pt-3">
            {attachments.map((attachment) => (
              <PreviewAttachment
                key={attachment.url}
                attachment={attachment}
                onRemove={() =>
                  setAttachments((current) =>
                    current.filter((item) => item.url !== attachment.url),
                  )
                }
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                key={filename}
                attachment={{
                  url: "",
                  filename,
                  mediaType: "application/octet-stream",
                  type: "file",
                }}
                isUploading={true}
              />
            ))}
          </div>
        )}

        <SkillPicker
          ref={skillPickerRef}
          agentId={agentId}
          input={input}
          setInput={setInput}
          textareaRef={textareaRef}
        />
        <Textarea
          ref={textareaRef}
          placeholder={
            aiAvailable
              ? `Message ${agentName}…`
              : "Connect an AI provider to begin…"
          }
          disabled={!aiAvailable}
          value={input}
          onChange={handleInput}
          className="min-h-16 max-h-[200px] resize-none overflow-y-auto rounded-none border-0 bg-transparent px-4 pb-2 pt-4 text-[15px] leading-6 shadow-none focus-visible:border-0 focus-visible:bg-transparent focus-visible:ring-0 dark:bg-transparent dark:focus-visible:bg-transparent"
          rows={2}
          onKeyDown={(event) => {
            if (skillPickerRef.current?.handleKeyDown(event)) return;
            if (event.key === "Escape" && isLoading) {
              event.preventDefault();
              stop();
              return;
            }
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.altKey
            ) {
              event.preventDefault();

              submitForm();
            }
          }}
        />
        <div className="flex min-h-12 flex-wrap items-center gap-1.5 px-2.5 pb-2.5">
          <span
            className="flex max-w-[180px] shrink items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.07] px-2.5 py-1 text-xs text-foreground"
            title={
              thinkingProviderLabel
                ? "Workspace Thinking is ready"
                : "Workspace thinking model unavailable"
            }
          >
            <BrainCircuit size={13} className="shrink-0 text-primary" />
            <span className="truncate">
              {thinkingProviderLabel ? "Thinking" : "Thinking unavailable"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onHumanizerChange(!humanizerEnabled)}
            disabled={!humanizerAvailable}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              humanizerEnabled && humanizerAvailable
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
            }`}
            title={
              humanizerAvailable
                ? humanizerEnabled
                  ? "Humanizer on: final answers use the workspace end processor"
                  : "Humanizer off: the thinking model writes the final answer"
                : "Ask an administrator to configure a Humanizer model"
            }
            aria-pressed={humanizerEnabled && humanizerAvailable}
            aria-label={humanizerEnabled ? "Disable Humanizer" : "Enable Humanizer"}
          >
            <WandSparkles size={13} />
            Humanizer
          </button>
          <div
            role="group"
            aria-label="Research depth"
            title={
              researchDepth === "deep"
                ? "Deep: Notebook + web corroboration"
                : "Quick: Notebook only"
            }
            className="flex shrink-0 items-center rounded-full border border-border/70 bg-foreground/[0.03] p-0.5 dark:border-border"
          >
            {(
              [
                {
                  value: "quick" as const,
                  label: "Quick",
                  icon: Zap,
                  hint: "Switch to Quick research",
                },
                {
                  value: "deep" as const,
                  label: "Deep",
                  icon: Compass,
                  hint: "Switch to Deep research",
                },
              ] as const
            ).map(({ value, label, icon: Icon, hint }) => (
              <button
                key={value}
                type="button"
                onClick={() => onResearchDepthChange(value)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  researchDepth === value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                }`}
                aria-pressed={researchDepth === value}
                aria-label={hint}
              >
                <Icon size={13} aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1" />

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title={`Tune ${agentName}`}
              aria-label={`Tune ${agentName}`}
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link href="/settings/agent">
                <SlidersHorizontal size={16} />
              </Link>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Add an image"
              aria-label="Add an image"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => imageInputRef.current?.click()}
              disabled={isLoading || !aiAvailable}
            >
              <ImagePlus size={16} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="Attach a file"
              aria-label="Attach a file"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !aiAvailable}
            >
              <FileUp size={16} />
            </Button>
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                className="size-8 rounded-full bg-primary text-primary-foreground shadow-none hover:bg-primary/90"
                onClick={stop}
                aria-label="Stop generating"
              >
                <StopIcon size={13} />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              className="size-8 rounded-full bg-gradient-to-br from-primary to-sky-500 text-white shadow-none hover:shadow-[0_4px_16px_hsl(var(--primary)/0.35)] active:scale-[0.96]"
              onClick={submitForm}
              aria-label={isLoading ? "Queue message" : "Send message"}
              title={isLoading ? "Queue message" : "Send message"}
              disabled={
                !aiAvailable ||
                Boolean(isLoading && queuedMessage) ||
                (!input.trim() && attachments.length === 0) ||
                uploadQueue.length > 0
              }
            >
              <ArrowUpIcon size={14} />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 px-10 text-center text-[10px] text-muted-foreground sm:justify-between sm:px-2 sm:text-left">
        <span>Kairo can make mistakes. Verify important information.</span>
        <span className="hidden shrink-0 items-center gap-2.5 sm:inline-flex">
          <kbd className="font-mono">Shift ↵</kbd>
          new line
          {isLoading ? (
            <>
              <span aria-hidden>·</span>
              <kbd className="font-mono">Esc</kbd>
              stop
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
