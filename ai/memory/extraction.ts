import { generateText, Output } from "ai";
import { z } from "zod";

import {
  MEMORY_CATEGORIES,
  saveUserMemory,
} from "@/db/memory-queries";

import type { LanguageModel, UIMessage } from "ai";

const extractionSchema = z.object({
  memories: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(1).max(4000),
        tags: z.array(z.string().trim().min(1).max(50)).max(10),
        category: z.enum(MEMORY_CATEGORIES),
        priority: z.number().int().min(0).max(10),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(5),
});

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")
    .trim();
}

export function latestCompletedExchange(messages: UIMessage[]) {
  const assistantIndex = messages.findLastIndex(
    (message) => message.role === "assistant" && messageText(message),
  );
  if (assistantIndex < 0) return null;

  const user = messages
    .slice(0, assistantIndex)
    .findLast((message) => message.role === "user" && messageText(message));
  if (!user) return null;

  return {
    userMessage: messageText(user).slice(0, 6_000),
    assistantResponse: messageText(messages[assistantIndex]).slice(0, 8_000),
  };
}

export function highConfidenceMemories(
  candidates: z.infer<typeof extractionSchema>["memories"],
) {
  return candidates.filter((candidate) => candidate.confidence >= 0.85);
}

export async function extractAndSaveMemories(input: {
  messages: UIMessage[];
  userId: string;
  agentId: string;
  model: LanguageModel;
}) {
  const exchange = latestCompletedExchange(input.messages);
  if (!exchange) return [];

  const result = await generateText({
    model: input.model,
    output: Output.object({ schema: extractionSchema }),
    maxOutputTokens: 1_200,
    temperature: 0,
    system: `Extract durable user memories from the user's own words.

Include only facts, preferences, ongoing context, or notes that will likely matter in a future conversation.
Never extract credentials, secrets, authentication data, financial account data, health details, or other highly sensitive personal data.
Never treat assistant statements as facts about the user.
Never extract facts or claims merely because they appeared in a linked or retrieved webpage. Save a URL only when the user explicitly asked to remember or bookmark it, and preserve the user's reason rather than copied page content.
Exclude one-off requests, temporary details, speculation, and information already framed as uncertain.
Use concise neutral wording. Return at most five candidates. Confidence must reflect how explicitly the user stated the information.`,
    prompt: `User message:
${exchange.userMessage}

Assistant response (context only; do not extract facts from it):
${exchange.assistantResponse}`,
  });

  const saved = [];
  for (const candidate of highConfidenceMemories(result.output.memories)) {
    saved.push(
      await saveUserMemory({
        userId: input.userId,
        agentId: input.agentId,
        title: candidate.title,
        content: candidate.content,
        tags: candidate.tags,
        category: candidate.category,
        priority: candidate.priority,
        source: "auto-extracted",
      }),
    );
  }
  return saved;
}
