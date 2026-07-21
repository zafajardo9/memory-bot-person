import { createKnowledgeTools } from "@/ai/knowledge-tools";
import { isKnowledgeChatEnabled } from "@/lib/knowledge/config";

import { createFlightTools } from "./flights";
import { createWeatherTools } from "./weather";

import type { LanguageModel } from "ai";

export function createChatTools(input: {
  model: LanguageModel;
  userId: string;
  chatId: string;
}) {
  return {
    ...(isKnowledgeChatEnabled()
      ? createKnowledgeTools({ userId: input.userId, chatId: input.chatId })
      : {}),
    ...createWeatherTools(),
    ...createFlightTools({ model: input.model, userId: input.userId }),
  };
}
