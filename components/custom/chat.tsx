"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { useCallback, useState } from "react";

import { Message as PreviewMessage } from "@/components/custom/message";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";

import { ModelSelector } from "./model-selector";
import { MultimodalInput } from "./multimodal-input";
import { Overview } from "./overview";

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: UIMessage[];
}) {
  const { messages, sendMessage, status, stop } = useChat({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({ body: { id } }),
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

  return (
    <main className="flex h-dvh flex-row justify-center bg-background pb-4 md:pb-6">
      <div className="flex w-full flex-col items-center justify-between gap-4">
        <div
          ref={messagesContainerRef}
          className="flex flex-col items-center gap-5 overflow-y-auto scroll-smooth size-full"
        >
          {messages.length === 0 && <Overview />}

          {messages.map((message) => (
            <PreviewMessage
              key={message.id}
              chatId={id}
              message={message}
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
            messages={messages}
            sendMessage={sendMessage}
            modelSelector={
              <ModelSelector onAvailabilityChange={handleAvailabilityChange} />
            }
          />
        </form>
      </div>
    </main>
  );
}
