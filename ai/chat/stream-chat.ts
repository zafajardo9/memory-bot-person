import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import { companyAssistantSystemPrompt } from "@/ai/prompts/company-assistant";
import { resolveUserLanguageModel } from "@/ai/providers/service";
import { createChatTools } from "@/ai/tools";
import { isKnowledgeChatEnabled } from "@/lib/knowledge/config";
import { searchCompanyKnowledge } from "@/lib/knowledge/retrieval";

function latestUserText(messages: UIMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  if (!latest) return "";
  return latest.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")
    .trim();
}

async function knowledgePreflight(
  messages: UIMessage[],
  userId: string,
  chatId: string,
) {
  if (!isKnowledgeChatEnabled()) return "";
  const query = latestUserText(messages);
  if (!query) return "";
  try {
    const matches = await searchCompanyKnowledge({
      query,
      userId,
      chatId,
      limit: 4,
    });
    return matches.length
      ? `\n\nPreflight approved knowledge candidates (you must still call the knowledge tools before the final answer):\n${matches
          .map((match) => `- 【${match.citation}】 ${match.content}`)
          .join("\n")}`
      : "\n\nPreflight knowledge check found no relevant approved company source. Use the knowledge tool and do not invent company policy.";
  } catch (error) {
    console.error("Knowledge preflight failed", error);
    return "\n\nThe company knowledge service is temporarily unavailable. State this limitation for company-specific questions.";
  }
}

export async function streamCompanyChat(input: {
  chatId: string;
  messages: UIMessage[];
  userId: string;
}) {
  const selected = await resolveUserLanguageModel(input.userId);
  const modelMessages = (
    await convertToModelMessages(input.messages, {
      ignoreIncompleteToolCalls: true,
    })
  ).filter((message) => message.content.length > 0);
  const preflight = await knowledgePreflight(
    input.messages,
    input.userId,
    input.chatId,
  );

  const result = streamText({
    model: selected.model,
    system: `${companyAssistantSystemPrompt}\nToday's date is ${new Date().toLocaleDateString()}.${preflight}`,
    messages: modelMessages,
    stopWhen: stepCountIs(10),
    tools: createChatTools({
      model: selected.model,
      userId: input.userId,
      chatId: input.chatId,
    }),
    experimental_telemetry: {
      isEnabled: true,
      functionId: `chat:${selected.providerId}:${selected.modelId}`,
    },
  });

  return { result, selection: selected };
}
