import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
  wrapLanguageModel,
} from "ai";

import { createMemoryMiddleware } from "@/ai/custom-middleware";
import { companyAssistantSystemPrompt } from "@/ai/prompts/company-assistant";
import { resolveUserLanguageModel } from "@/ai/providers/service";
import { createChatTools } from "@/ai/tools";
import { getAgentForUser } from "@/db/agent-queries";
import { formatAgentSettingsForPrompt } from "@/lib/agent-settings";
import { agentSettingsFromProfile, toolEnabled } from "@/lib/agents";
import { isKnowledgeChatEnabled } from "@/lib/knowledge/config";
import { searchCompanyKnowledge } from "@/lib/knowledge/retrieval";
import {
  hasWebResearchConsent,
  linkToolPlan,
  webResearchInstruction,
} from "@/lib/web/consent";

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
  agentId: string,
  enabledTools: string[],
) {
  if (
    !isKnowledgeChatEnabled() ||
    !toolEnabled(enabledTools, "knowledge")
  ) return "";
  const query = latestUserText(messages);
  if (!query) return "";
  try {
    const matches = await searchCompanyKnowledge({
      query,
      userId,
      chatId,
      agentId,
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
  agentId: string;
}) {
  const userText = latestUserText(input.messages);
  const webAccessApproved = hasWebResearchConsent(input.messages);
  const agent = await getAgentForUser(input.agentId, input.userId);
  if (!agent) throw new Error("Agent not found.");
  const [selected] = await Promise.all([
    resolveUserLanguageModel(input.userId, input.agentId),
  ]);
  const agentSettings = agentSettingsFromProfile(agent);
  const modelMessages = (
    await convertToModelMessages(input.messages, {
      ignoreIncompleteToolCalls: true,
    })
  ).filter((message) => message.content.length > 0);
  const preflight = await knowledgePreflight(
    input.messages,
    input.userId,
    input.chatId,
    input.agentId,
    agent.enabledTools,
  );
  const model =
    typeof selected.model === "string" ||
    !toolEnabled(agent.enabledTools, "memory")
      ? selected.model
      : wrapLanguageModel({
          model: selected.model,
          middleware: createMemoryMiddleware(input.userId, input.agentId),
        });

  const tools = await createChatTools({
    model: selected.model,
    userId: input.userId,
    chatId: input.chatId,
    agentId: input.agentId,
    enabledTools: agent.enabledTools,
    webAccessApproved,
  });
  const linkPlan = linkToolPlan(userText, {
    readWebPage: "readWebPage" in tools,
    browseWebPage: "browseWebPage" in tools,
    webSearch: "webSearch" in tools,
  });

  const result = streamText({
    model,
    system: `${companyAssistantSystemPrompt}\n\n${webResearchInstruction(webAccessApproved, userText)}\n\n${formatAgentSettingsForPrompt(agentSettings)}\n\nToday's date is ${new Date().toLocaleDateString()}.${preflight}`,
    messages: modelMessages,
    stopWhen: stepCountIs(10),
    tools,
    prepareStep: ({ stepNumber }) => {
      if (stepNumber === 0 && linkPlan.reader) {
        return {
          activeTools: [linkPlan.reader],
          toolChoice: { type: "tool", toolName: linkPlan.reader },
        };
      }
      if (stepNumber === 1 && linkPlan.expandWithSearch) {
        return {
          activeTools: ["webSearch"],
          toolChoice: { type: "tool", toolName: "webSearch" },
        };
      }
      return {};
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: `chat:${selected.providerId}:${selected.modelId}`,
    },
  });

  return {
    result,
    selection: selected,
    extractionModel: selected.model,
    memoryEnabled: toolEnabled(agent.enabledTools, "memory"),
  };
}
