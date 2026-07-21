import { generateId, type DynamicToolUIPart, type UIMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Chat } from "@/db/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      "An error occurred while fetching the data.",
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getLocalStorage(key: string) {
  if (typeof window !== "undefined") {
    return JSON.parse(localStorage.getItem(key) || "[]");
  }
  return [];
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type LegacyPart = {
  type?: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
};

type LegacyMessage = {
  id?: string;
  role?: string;
  content?: string | LegacyPart[];
};

function isUIMessage(message: unknown): message is UIMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "id" in message &&
    "role" in message &&
    "parts" in message &&
    Array.isArray(message.parts)
  );
}

export function convertToUIMessages(messages: unknown[]): UIMessage[] {
  const chatMessages: UIMessage[] = [];

  for (const value of messages) {
    if (isUIMessage(value)) {
      chatMessages.push(value);
      continue;
    }

    const message = value as LegacyMessage;
    if (message.role === "tool" && Array.isArray(message.content)) {
      for (const result of message.content) {
        if (result.type !== "tool-result" || !result.toolCallId) continue;
        for (const chatMessage of chatMessages) {
          chatMessage.parts = chatMessage.parts.map((part) => {
            if (
              part.type === "dynamic-tool" &&
              part.toolCallId === result.toolCallId
            ) {
              return {
                ...part,
                state: "output-available",
                output: result.result,
              } as DynamicToolUIPart;
            }
            return part;
          });
        }
      }
      continue;
    }

    if (
      message.role !== "system" &&
      message.role !== "user" &&
      message.role !== "assistant"
    ) {
      continue;
    }

    const parts: UIMessage["parts"] = [];
    if (typeof message.content === "string") {
      if (message.content) parts.push({ type: "text", text: message.content });
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === "text" && content.text) {
          parts.push({ type: "text", text: content.text });
        } else if (
          content.type === "tool-call" &&
          content.toolCallId &&
          content.toolName
        ) {
          parts.push({
            type: "dynamic-tool",
            toolCallId: content.toolCallId,
            toolName: content.toolName,
            state: "input-available",
            input: content.args,
          });
        }
      }
    }

    chatMessages.push({
      id: message.id ?? generateId(),
      role: message.role,
      parts,
    });
  }

  return chatMessages;
}

export function getTitleFromChat(chat: Chat) {
  const messages = convertToUIMessages(chat.messages);
  const firstMessage = messages[0];

  if (!firstMessage) {
    return "Untitled";
  }

  return (
    firstMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("") || "Untitled"
  );
}
