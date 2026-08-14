import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type LanguageModel,
  type UIMessage,
  type UIMessageChunk,
  type UIMessageStreamOnFinishCallback,
  wrapLanguageModel,
} from "ai";

import { createMemoryMiddleware } from "@/ai/custom-middleware";
import { companyAssistantSystemPrompt } from "@/ai/prompts/company-assistant";
import {
  resolveWorkspaceHumanizerModel,
  resolveWorkspaceResearchModel,
} from "@/ai/providers/research-settings";
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

interface ChatStreamResponseOptions {
  originalMessages?: UIMessage[];
  sendReasoning?: boolean;
  sendSources?: boolean;
  onError?: (error: unknown) => string;
  onFinish?: UIMessageStreamOnFinishCallback<UIMessage>;
}

function isResearchNarrativeChunk(chunk: UIMessageChunk) {
  return (
    chunk.type === "text-start" ||
    chunk.type === "text-delta" ||
    chunk.type === "text-end" ||
    chunk.type === "reasoning-start" ||
    chunk.type === "reasoning-delta" ||
    chunk.type === "reasoning-end"
  );
}

export async function streamCompanyChat(input: {
  chatId: string;
  messages: UIMessage[];
  userId: string;
  agentId: string;
  researchDepth?: string;
  humanizerEnabled?: boolean;
}) {
  const userText = latestUserText(input.messages);
  const isDeepMode = input.researchDepth === "deep";
  const webAccessApproved =
    hasWebResearchConsent(input.messages) || isDeepMode;
  const agent = await getAgentForUserDetailed(input.agentId, input.userId);
  if (!agent) throw new Error("Agent not found.");
  const humanizerRequested = input.humanizerEnabled !== false;
  const [researchSelection, humanizerSelection] = await Promise.all([
    resolveWorkspaceResearchModel(),
    !humanizerRequested
      ? Promise.resolve(null)
      : resolveWorkspaceHumanizerModel(),
  ]);
  const selected =
    researchSelection ??
    (await resolveUserLanguageModel(input.userId, input.agentId));
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
    researchSelection?.model ?? selected.model,
  );
  const writerSelection = humanizerSelection ?? selected;
  const writerModel = writerSelection.model;
  const researchBaseModel = selected.model;
  const researchModel =
    typeof researchBaseModel === "string" ||
    !toolEnabled(agent.enabledTools, "memory")
      ? researchBaseModel
      : wrapLanguageModel({
          model: researchBaseModel,
          middleware: createMemoryMiddleware(input.userId, input.agentId),
        });

  const tools = await createChatTools({
    model: researchBaseModel,
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

  const system = `${companyAssistantSystemPrompt}\n\n${webResearchInstruction(webAccessApproved, userText, isDeepMode)}\n\n${formatAgentSettingsForPrompt(agentSettings)}\n\nToday's date is ${new Date().toLocaleDateString()}.${preflight}`;
  const prepareStep = ({ stepNumber }: { stepNumber: number }) => {
    if (stepNumber === 0 && linkPlan.reader) {
      return {
        activeTools: [linkPlan.reader] as Array<keyof typeof tools>,
        toolChoice: { type: "tool" as const, toolName: linkPlan.reader },
      };
    }
    if (stepNumber === 1 && linkPlan.expandWithSearch) {
      return {
        activeTools: ["webSearch"] as Array<keyof typeof tools>,
        toolChoice: { type: "tool" as const, toolName: "webSearch" as const },
      };
    }
    return {};
  };

  const singleModelResult = () => streamText({
    model: researchModel,
    system,
    messages: modelMessages,
    stopWhen: stepCountIs(14),
    tools,
    prepareStep,
    experimental_telemetry: {
      isEnabled: true,
      functionId: `chat:${selected.providerId}:${selected.modelId}`,
    },
  });

  const splitFlow = Boolean(researchSelection || humanizerRequested);
  const result = splitFlow
    ? {
        toUIMessageStreamResponse(options: ChatStreamResponseOptions = {}) {
          const onError = options.onError ?? (() => "An error occurred.");
          const stream = createUIMessageStream<UIMessage>({
            originalMessages: options.originalMessages,
            onError,
            onFinish: options.onFinish,
            execute: async ({ writer }) => {
              const researchResult = streamText({
                model: researchModel,
                system: `${system}\n\nRESEARCH PHASE: Gather the evidence needed for the user's request. Use the available tools when they can improve grounding. End with a compact evidence brief for the answer-writing model; do not address the user directly.`,
                messages: modelMessages,
                stopWhen: stepCountIs(10),
                tools,
                prepareStep,
                experimental_telemetry: {
                  isEnabled: true,
                  functionId: `research:${selected.providerId}:${selected.modelId}:writer:${writerSelection.providerId}:${writerSelection.modelId}`,
                },
              });
              const researchUIStream = researchResult
                .toUIMessageStream({
                  sendStart: true,
                  sendFinish: false,
                  sendReasoning: false,
                  sendSources: options.sendSources,
                  onError,
                })
                .pipeThrough(
                  new TransformStream<UIMessageChunk, UIMessageChunk>({
                    transform(chunk, controller) {
                      if (!isResearchNarrativeChunk(chunk)) controller.enqueue(chunk);
                    },
                  }),
                );
              writer.merge(researchUIStream);

              const researchResponse = await researchResult.response;
              const writerResult = streamText({
                model: writerModel,
                system: `${system}\n\nANSWER PHASE: Write the final answer to the user now. The immediately preceding assistant/tool transcript contains the gathered evidence. Use it as evidence, preserve valid citations, do not call tools, and do not mention this handoff.${humanizerRequested ? " Humanize the answer: make it clear, natural, warm, direct, and free of robotic phrasing without changing facts or citations." : " Keep the answer clear and direct without adding an extra rewriting style."}`,
                messages: [...modelMessages, ...researchResponse.messages],
                experimental_telemetry: {
                  isEnabled: true,
                  functionId: `answer:${writerSelection.providerId}:${writerSelection.modelId}:thinking:${selected.providerId}:${selected.modelId}:humanizer:${humanizerRequested}`,
                },
              });
              writer.merge(
                writerResult.toUIMessageStream({
                  sendStart: false,
                  sendFinish: true,
                  sendReasoning: options.sendReasoning,
                  sendSources: options.sendSources,
                  onError,
                }),
              );
            },
          });
          return createUIMessageStreamResponse({ stream });
        },
      }
    : singleModelResult();

  return {
    result,
    selection: selected,
    extractionModel: writerModel,
    memoryEnabled: toolEnabled(agent.enabledTools, "memory"),
  };
}
