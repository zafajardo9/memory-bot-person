"use client";

import {
  FileUp,
  ImagePlus,
  Lightbulb,
  SlidersHorizontal,
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
import useWindowSize from "./use-window-size";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

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
  modelSelector,
  thinking,
  onThinkingChange,
  agentName,
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
  modelSelector: React.ReactNode;
  thinking: boolean;
  onThinkingChange: (value: boolean) => void;
  agentName: string;
  chatError?: Error;
  clearChatError: () => void;
  retryLastMessage: () => Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
      toast.error("Choose an available AI provider before sending a message.");
      return;
    }
    const text = input.trim();
    if (!text && attachments.length === 0) return;

    void sendMessage({ text, files: attachments });
    setInput("");

    setAttachments([]);

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [aiAvailable, attachments, input, sendMessage, setAttachments, setInput, width]);

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
                className="rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="overflow-hidden rounded-[20px] border bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.07)] transition-[border-color,box-shadow] focus-within:border-primary/35 focus-within:shadow-[0_10px_36px_hsl(var(--foreground)/0.1)]">
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

        <div className="border-b border-border/60 px-4 py-1.5">
          {modelSelector}
        </div>

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
          className="min-h-16 max-h-[200px] resize-none overflow-y-auto rounded-none border-0 bg-transparent px-4 pb-2 pt-4 text-[15px] leading-6 shadow-none focus-visible:border-0 focus-visible:ring-0"
          rows={2}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();

              if (isLoading) {
                toast.error("Please wait for the model to finish its response!");
              } else {
                submitForm();
              }
            }
          }}
        />

        <div className="flex min-h-12 items-center gap-2 px-2.5 pb-2.5">
          <button
            type="button"
            onClick={() => onThinkingChange(!thinking)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              thinking
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            title={thinking ? "Reasoning on" : "Reasoning off"}
            aria-label={thinking ? "Disable reasoning" : "Enable reasoning"}
          >
            <Lightbulb size={13} />
            Think
          </button>
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
                className="size-8 rounded-full"
                onClick={stop}
                aria-label="Stop generating"
              >
                <StopIcon size={13} />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                className="size-8 rounded-full"
                onClick={submitForm}
                aria-label="Send message"
                disabled={
                  !aiAvailable ||
                  (!input.trim() && attachments.length === 0) ||
                  uploadQueue.length > 0
                }
              >
                <ArrowUpIcon size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 px-10 text-center text-[10px] text-muted-foreground sm:justify-between sm:px-2 sm:text-left">
        <span>Memory can make mistakes. Verify important information.</span>
        <span className="hidden shrink-0 sm:inline">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Shift ↵</kbd>{" "}
          for a new line
        </span>
      </div>
    </div>
  );
}
