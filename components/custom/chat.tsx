"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isTextUIPart,
  type FileUIPart,
  type UIMessage,
} from "ai";
import { useCallback, useMemo, useState } from "react";

import { Message as PreviewMessage } from "@/components/custom/message";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";

import { ModelSelector } from "./model-selector";
import { MultimodalInput } from "./multimodal-input";
import { Overview } from "./overview";

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
    transport: new DefaultChatTransport({ body: { id, agentId } }),
    onFinish: () => {
      window.history.replaceState({}, "", `/chat/${id}`);
    },
  });
  const [input, setInput] = useState("");
  const [aiAvailable, setAIAvailable] = useState(false);
  const handleAvailabilityChange = useCallback((available: boolean) => {
    setAIAvailable(available);
  }, []);

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

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
    <main className="flex h-dvh flex-row justify-center bg-background pb-4 md:pb-6">
      <div className="flex w-full flex-col items-center justify-between gap-4">
        <div
          ref={messagesContainerRef}
          className="flex flex-col items-center gap-5 overflow-y-auto scroll-smooth size-full"
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
            className="shrink-0 min-w-[24px] min-h-[24px]"
          />
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
