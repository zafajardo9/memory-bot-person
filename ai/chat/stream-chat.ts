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
  type UIMessageStreamOptions,
  wrapLanguageModel,
} from "ai";

import { shouldUseCompanyKnowledge } from "@/ai/chat/retrieval-gate";
import { createMemoryMiddleware } from "@/ai/custom-middleware";
import { companyAssistantSystemPrompt } from "@/ai/prompts/company-assistant";
import {
  resolveWorkspaceHumanizerModel,
  resolveWorkspaceResearchModel,
} from "@/ai/providers/research-settings";
import { resolveUserLanguageModel } from "@/ai/providers/service";
import { createChatTools } from "@/ai/tools";
import { getAgentForUserDetailed } from "@/db/agent-queries";
import {
  getUserSkillBySlug,
  incrementSkillUsage,
} from "@/db/skill-queries";
import { formatAgentSettingsForPrompt } from "@/lib/agent-settings";
import { agentSettingsFromProfile, toolEnabled } from "@/lib/agents";
import { isKnowledgeChatEnabled } from "@/lib/knowledge/config";
import { searchCompanyKnowledge } from "@/lib/knowledge/retrieval";
import {
  formatSkillInstructionsForPrompt,
  isChatSkillsEnabled,
  parseSlashSkill,
  stripLeadingSkillCommand,
  type AppliedSkill,
  type ChatMessageMetadata,
} from "@/lib/skills";
import {
  hasWebResearchConsent,
  linkToolPlan,
  webResearchInstruction,
} from "@/lib/web/consent";

type ChatUIMessage = UIMessage<ChatMessageMetadata>;

function latestUserText(messages: UIMessage[]) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  if (!latest) return "";
  return latest.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")
    .trim();
}

async function resolveTurnSkill(
  messages: ChatUIMessage[],
  userId: string,
): Promise<{
  messages: ChatUIMessage[];
  appliedSkill?: AppliedSkill;
  skillPrompt: string;
}> {
  if (!isChatSkillsEnabled()) return { messages, skillPrompt: "" };
  const parsed = parseSlashSkill(latestUserText(messages));
  if (!parsed) return { messages, skillPrompt: "" };

  try {
    const skill = await getUserSkillBySlug(userId, parsed.slug);
    if (!skill?.enabled) return { messages, skillPrompt: "" };

    const appliedSkill = { id: skill.id, slug: skill.slug, name: skill.name };
    void incrementSkillUsage(userId, skill.id).catch((error) => {
      console.error("Failed to increment skill usage", error);
    });
    return {
      messages: stripLeadingSkillCommand(messages, skill.slug),
      appliedSkill,
      skillPrompt: formatSkillInstructionsForPrompt(skill),
    };
  } catch (error) {
    console.error("Chat skill resolution failed", error);
    return { messages, skillPrompt: "" };
  }
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
      persistTelemetry: false,
    });
    if (!matches.length) {
      return "\n\nNOTEBOOK CHECK: The preflight search found no relevant approved company source. If the question is about company matters, state that the answer was not found in approved company knowledge, and clearly separate any general guidance. If it is not a company question, answer normally without the company framing.";
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
  originalMessages?: ChatUIMessage[];
  sendReasoning?: boolean;
  sendSources?: boolean;
  onError?: (error: unknown) => string;
  onFinish?: UIMessageStreamOnFinishCallback<ChatUIMessage>;
  messageMetadata?: UIMessageStreamOptions<ChatUIMessage>["messageMetadata"];
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
  messages: ChatUIMessage[];
  userId: string;
  agentId: string;
  researchDepth?: string;
  humanizerEnabled?: boolean;
}) {
  const turnSkill = await resolveTurnSkill(input.messages, input.userId);
  const messages = turnSkill.messages;
  const userText = latestUserText(messages);
  const isDeepMode = input.researchDepth === "deep";
  const webAccessApproved =
    hasWebResearchConsent(messages) || isDeepMode;
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
    await convertToModelMessages(messages, {
      ignoreIncompleteToolCalls: true,
    })
  ).filter((message) => message.content.length > 0);
  // Gate the notebook preflight: greetings and other clearly non-company
  // turns skip retrieval entirely. Deep research is explicit intent, and the
  // gate itself fails open (errors/timeouts run the preflight).
  const gateModel = researchSelection?.model ?? selected.model;
  const knowledgeAvailable =
    isKnowledgeChatEnabled() && toolEnabled(agent.enabledTools, "knowledge");
  const runPreflight =
    knowledgeAvailable &&
    userText !== "" &&
    (isDeepMode ||
      typeof gateModel === "string" ||
      (await shouldUseCompanyKnowledge({ query: userText, model: gateModel })));
  const preflight = runPreflight
    ? await knowledgePreflight(
        messages,
        input.userId,
        input.chatId,
        input.agentId,
        agent.enabledTools,
        gateModel,
      )
    : "";
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

  const system = `${companyAssistantSystemPrompt}\n\n${webResearchInstruction(webAccessApproved, userText, isDeepMode)}\n\n${formatAgentSettingsForPrompt(agentSettings, {
    styleOverriddenBySkill: Boolean(turnSkill.appliedSkill),
  })}${turnSkill.skillPrompt ? `\n\n${turnSkill.skillPrompt}` : ""}\n\nToday's date is ${new Date().toLocaleDateString()}.${preflight}`;
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

  // Only split into research + answer phases when there is an actual second
  // model to do the work. When the Humanizer is toggled on but no Humanizer
  // model is configured (and no research role is set), splitting would run the
  // same model through two full passes for zero benefit.
  const splitFlow = Boolean(researchSelection || humanizerSelection);
  const result = splitFlow
    ? {
        toUIMessageStreamResponse(options: ChatStreamResponseOptions = {}) {
          const onError = options.onError ?? (() => "An error occurred.");
          const stream = createUIMessageStream<ChatUIMessage>({
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
                .toUIMessageStream<ChatUIMessage>({
                  sendStart: true,
                  sendFinish: false,
                  sendReasoning: false,
                  sendSources: options.sendSources,
                  messageMetadata: options.messageMetadata,
                  onError,
                })
                .pipeThrough(
                  new TransformStream<
                    UIMessageChunk<ChatMessageMetadata>,
                    UIMessageChunk<ChatMessageMetadata>
                  >({
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
                writerResult.toUIMessageStream<ChatUIMessage>({
                  sendStart: false,
                  sendFinish: true,
                  sendReasoning: options.sendReasoning,
                  sendSources: options.sendSources,
                  messageMetadata: options.messageMetadata,
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
    appliedSkill: turnSkill.appliedSkill,
  };
}
