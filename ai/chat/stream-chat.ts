import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type LanguageModel,
  type UIMessage,
  wrapLanguageModel,
} from "ai";

import { createMemoryMiddleware } from "@/ai/custom-middleware";
import { companyAssistantSystemPrompt } from "@/ai/prompts/company-assistant";
import { resolveUserLanguageModel } from "@/ai/providers/service";
import { createChatTools } from "@/ai/tools";
import { getAgentForUserDetailed } from "@/db/agent-queries";
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
  rerankModel: LanguageModel,
) {
  if (
    !isKnowledgeChatEnabled() ||
    !toolEnabled(enabledTools, "knowledge")
  ) return "";
  const query = latestUserText(messages);
  if (!query) return "";
  try {
    const { results: matches } = await searchCompanyKnowledge({
      query,
      userId,
      chatId,
      agentId,
      limit: 8,
      rerankModel,
    });
    if (!matches.length) {
      return "\n\nNOTEBOOK CHECK: The preflight search found no relevant approved company source. State that the answer was not found in approved company knowledge, and clearly separate any general guidance.";
    }
    const evidence = matches
      .map(
        (match, index) =>
          `[${index + 1}] chunkId=${match.chunkId} 【${match.citation}】 ${match.content}`,
      )
      .join("\n");
    return `\n\nNOTEBOOK EVIDENCE (preflight retrieval — approved company sources already retrieved for this turn):\n${evidence}\n\nTreat the passages above as your initial evidence: answer from them and cite each company-specific claim with 【title — section or page】. Call readCompanyKnowledge for the most relevant chunk ids to widen context when you need more than the excerpts above. Only call searchCompanyKnowledge again for a focused sub-question this evidence does not already cover — do not re-run the same query.`;
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
  researchDepth?: string;
}) {
  const userText = latestUserText(input.messages);
  const isDeepMode = input.researchDepth === "deep";
  const webAccessApproved =
    hasWebResearchConsent(input.messages) || isDeepMode;
  const agent = await getAgentForUserDetailed(input.agentId, input.userId);
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
    selected.model,
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
    system: `${companyAssistantSystemPrompt}\n\n${webResearchInstruction(webAccessApproved, userText, isDeepMode)}\n\n${formatAgentSettingsForPrompt(agentSettings)}\n\nToday's date is ${new Date().toLocaleDateString()}.${preflight}`,
    messages: modelMessages,
    stopWhen: stepCountIs(14),
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
