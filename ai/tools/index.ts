import { createKnowledgeTools } from "@/ai/knowledge-tools";
import { toolEnabled } from "@/lib/agents";
import { isKnowledgeChatEnabled } from "@/lib/knowledge/config";
import { isUserMemoryEnabled } from "@/lib/memory/config";
import { isAgentBrowserInstalled } from "@/lib/web/agent-browser";
import {
  isAgentBrowserEnabled,
  isWebSearchEnabled,
} from "@/lib/web/config";
import { isWebSearchConfigured } from "@/lib/web/service";

import { createAgentBrowserTools } from "./agent-browser";
import { createCalculatorTool } from "./calculator";
import { createFlightTools } from "./flights";
import { createUserMemoryTools } from "./user-memory";
import { createWeatherTools } from "./weather";
import { createWebTools } from "./web-search";

import type { LanguageModel } from "ai";

export async function createChatTools(input: {
  model: LanguageModel;
  userId: string;
  chatId: string;
  agentId: string;
  enabledTools: string[];
  webAccessApproved: boolean;
}) {
  const publicWebEnabled =
    input.webAccessApproved && isWebSearchEnabled();
  const webSearchConfigured =
    publicWebEnabled &&
    (await isWebSearchConfigured());

  return {
    ...(isKnowledgeChatEnabled() &&
    toolEnabled(input.enabledTools, "knowledge")
      ? createKnowledgeTools({
          userId: input.userId,
          chatId: input.chatId,
          agentId: input.agentId,
          model: input.model,
        })
      : {}),
    ...(publicWebEnabled && toolEnabled(input.enabledTools, "web")
      ? createWebTools(input.userId, { searchEnabled: webSearchConfigured })
      : {}),
    ...(input.webAccessApproved &&
    isAgentBrowserEnabled() &&
    isAgentBrowserInstalled() &&
    toolEnabled(input.enabledTools, "browser")
      ? createAgentBrowserTools(input.userId)
      : {}),
    ...(isUserMemoryEnabled() && toolEnabled(input.enabledTools, "memory")
      ? createUserMemoryTools(input.userId, input.agentId)
      : {}),
    ...(toolEnabled(input.enabledTools, "weather") ? createWeatherTools() : {}),
    ...createCalculatorTool(),
    ...(toolEnabled(input.enabledTools, "flights")
      ? createFlightTools({ model: input.model, userId: input.userId })
      : {}),
  };
}
