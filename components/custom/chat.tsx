"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isTextUIPart,
  type FileUIPart,
  type UIMessage,
} from "ai";
import { ArrowDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Message as PreviewMessage } from "@/components/custom/message";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";

import { useRegisterActiveAgent } from "./active-agent-context";
import { ModelSelector } from "./model-selector";
import { MultimodalInput } from "./multimodal-input";
import { Overview } from "./overview";

export type ResearchDepth = "quick" | "deep";

export function Chat({
  id,
  initialMessages,
  agentName,
  agentId,
}: {
  id: string;
  initialMessages: UIMessage[];
  agentName: string;
  agentId: string;
}) {
  useRegisterActiveAgent(agentId);
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>("quick");
  const handleResearchDepthChange = useCallback((depth: ResearchDepth) => {
    setResearchDepth(depth);
  }, []);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: () => ({
          id,
          agentId,
          researchDepth,
        }),
      }),
    [agentId, id, researchDepth],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
    regenerate,
  } = useChat({
    id,
    messages: initialMessages,
    transport,
    onFinish: () => {
      window.history.replaceState({}, "", `/chat/${id}`);
    },
  });
  const [input, setInput] = useState("");
  const [aiAvailable, setAIAvailable] = useState(false);
  const handleAvailabilityChange = useCallback((available: boolean) => {
    setAIAvailable(available);
  }, []);

  const [messagesContainerRef, messagesEndRef, isAtBottom, scrollToBottom] =
    useScrollToBottom<HTMLDivElement>(initialMessages.length > 0);

  const [attachments, setAttachments] = useState<FileUIPart[]>([]);
  const isLoading = status === "submitted" || status === "streaming";
  const [thinking, setThinking] = useState(false);

  const dedupedMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);
  const latestUserMessage =
    [...dedupedMessages]
      .reverse()
      .find((message) => message.role === "user")
      ?.parts.filter(isTextUIPart)
      .map((part) => part.text)
      .join("")
      .trim() ?? "";

  return (
    <main className="flex h-dvh flex-row justify-center bg-transparent pb-[max(1rem,env(safe-area-inset-bottom))] pt-16 md:pb-6">
      <div className="flex w-full flex-col items-center justify-between gap-4 pt-3 sm:pt-4">
        <div className="relative min-h-0 w-full flex-1">
          <div
            ref={messagesContainerRef}
            className="flex size-full flex-col items-center gap-5 overflow-y-auto scroll-smooth"
          >
            {dedupedMessages.length === 0 && <Overview />}

            {dedupedMessages.map((message, index) => (
              <PreviewMessage
                key={message.id}
                chatId={id}
                message={message}
                agentName={agentName}
                userMessage={latestUserMessage}
                onSelectFollowUp={(question) => sendMessage({ text: question })}
                showFollowUps={
                  !isLoading &&
                  !error &&
                  index === dedupedMessages.length - 1 &&
                  message.role === "assistant"
                }
                isActive={
                  isLoading &&
                  index === dedupedMessages.length - 1 &&
                  message.role === "assistant"
                }
              />
            ))}

            <div
              ref={messagesEndRef}
              className="min-h-[24px] min-w-[24px] shrink-0"
            />
          </div>

          {!isAtBottom && dedupedMessages.length > 0 ? (
            <button
              type="button"
              onClick={scrollToBottom}
              className="glass-soft absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground transition-[background-color,transform] hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              aria-label="Jump to the latest message"
            >
              <ArrowDown size={13} aria-hidden />
              Jump to latest
            </button>
          ) : null}
        </div>

        <form className="relative w-[calc(100dvw-24px)] max-w-3xl sm:w-[calc(100dvw-32px)]">
          <MultimodalInput
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            aiAvailable={aiAvailable}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={dedupedMessages}
            sendMessage={sendMessage}
            modelSelector={
              <ModelSelector
                agentId={agentId}
                onAvailabilityChange={handleAvailabilityChange}
              />
            }
            thinking={thinking}
            onThinkingChange={setThinking}
            researchDepth={researchDepth}
            onResearchDepthChange={handleResearchDepthChange}
            agentName={agentName}
            chatError={error}
            clearChatError={clearError}
            retryLastMessage={() => regenerate()}
          />
        </form>
      </div>
    </main>
  );
}
