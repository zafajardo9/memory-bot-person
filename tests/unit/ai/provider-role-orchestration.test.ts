import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  resolveUserLanguageModel: vi.fn(),
  resolveWorkspaceResearchModel: vi.fn(),
  resolveWorkspaceHumanizerModel: vi.fn(),
  createChatTools: vi.fn(),
  getAgentForUserDetailed: vi.fn(),
  getUserSkillBySlug: vi.fn(),
  incrementSkillUsage: vi.fn(),
}));

vi.mock("@/ai/providers/service", () => ({
  resolveUserLanguageModel: mocks.resolveUserLanguageModel,
}));
vi.mock("@/ai/providers/research-settings", () => ({
  resolveWorkspaceHumanizerModel: mocks.resolveWorkspaceHumanizerModel,
  resolveWorkspaceResearchModel: mocks.resolveWorkspaceResearchModel,
}));
vi.mock("@/ai/tools", () => ({ createChatTools: mocks.createChatTools }));
vi.mock("@/ai/custom-middleware", () => ({
  createMemoryMiddleware: vi.fn(),
}));
vi.mock("@/ai/prompts/company-assistant", () => ({
  companyAssistantSystemPrompt: "Test assistant",
}));
vi.mock("@/db/agent-queries", () => ({
  getAgentForUserDetailed: mocks.getAgentForUserDetailed,
}));
vi.mock("@/db/skill-queries", () => ({
  getUserSkillBySlug: mocks.getUserSkillBySlug,
  incrementSkillUsage: mocks.incrementSkillUsage,
}));
vi.mock("@/lib/knowledge/config", () => ({
  isKnowledgeChatEnabled: () => false,
}));
vi.mock("@/lib/knowledge/retrieval", () => ({
  searchCompanyKnowledge: vi.fn(),
}));
vi.mock("@/lib/agents", () => ({
  agentSettingsFromProfile: () => ({}),
  toolEnabled: () => false,
}));
vi.mock("@/lib/agent-settings", () => ({
  escapePromptData: (value: string) => value,
  formatAgentSettingsForPrompt: () => "",
}));
vi.mock("@/lib/web/consent", () => ({
  hasWebResearchConsent: () => false,
  linkToolPlan: () => ({ reader: null, expandWithSearch: false }),
  webResearchInstruction: () => "",
}));

import { streamCompanyChat } from "@/ai/chat/stream-chat";

const usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};

function streamingModel(provider: string, modelId: string, text: string) {
  return new MockLanguageModelV4({
    provider,
    modelId,
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: text },
          { type: "text-end", id: "text-1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage,
          },
        ],
      }),
    }),
  });
}

const messages = [
  {
    id: "user-message",
    role: "user" as const,
    parts: [{ type: "text" as const, text: "Find the answer" }],
  },
];

describe("provider-role chat orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createChatTools.mockResolvedValue({});
    mocks.getAgentForUserDetailed.mockResolvedValue({ enabledTools: [] });
    mocks.resolveWorkspaceHumanizerModel.mockResolvedValue(null);
    mocks.getUserSkillBySlug.mockResolvedValue(null);
    mocks.incrementSkillUsage.mockResolvedValue(undefined);
  });

  it("resolves and applies an owned slash-command skill in chat", async () => {
    const writerModel = streamingModel("writer-provider", "writer", "SKILLED_ANSWER");
    mocks.resolveWorkspaceResearchModel.mockResolvedValue(null);
    mocks.resolveUserLanguageModel.mockResolvedValue({
      providerId: "writer-provider",
      modelId: "writer",
      model: writerModel,
    });
    mocks.getUserSkillBySlug.mockResolvedValue({
      id: "skill-id",
      slug: "brief",
      name: "Executive brief",
      instructions: "Start with the decision and use three bullets.",
      enabled: true,
    });

    const { result, appliedSkill } = await streamCompanyChat({
      chatId: "chat-id",
      userId: "user-id",
      agentId: "agent-id",
      messages: [
        {
          id: "user-message",
          role: "user",
          parts: [{ type: "text", text: "/brief Q3 revenue" }],
        },
      ],
      humanizerEnabled: false,
    });
    const body = await result
      .toUIMessageStreamResponse({
        messageMetadata: () => ({ appliedSkill: appliedSkill! }),
      })
      .text();

    expect(body).toContain("SKILLED_ANSWER");
    expect(body).toContain('"slug":"brief"');
    expect(appliedSkill).toEqual({
      id: "skill-id",
      slug: "brief",
      name: "Executive brief",
    });
    expect(mocks.getUserSkillBySlug).toHaveBeenCalledWith("user-id", "brief");
    expect(mocks.incrementSkillUsage).toHaveBeenCalledWith("user-id", "skill-id");
    expect(writerModel.doStreamCalls[0].prompt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Start with the decision and use three bullets."),
        }),
        expect.objectContaining({
          role: "user",
          content: expect.not.stringContaining("/brief"),
        }),
      ]),
    );
  });

  it("runs Thinking first, hides its narrative, and streams the Humanizer answer", async () => {
    const researchModel = streamingModel("research-provider", "research", "RESEARCH_ONLY");
    const writerModel = streamingModel("writer-provider", "writer", "WRITER_ONLY");
    mocks.resolveWorkspaceResearchModel.mockResolvedValue({
      providerId: "research-provider",
      modelId: "research",
      model: researchModel,
    });
    mocks.resolveWorkspaceHumanizerModel.mockResolvedValue({
      providerId: "writer-provider",
      modelId: "writer",
      model: writerModel,
    });

    const { result, extractionModel } = await streamCompanyChat({
      chatId: "chat-id",
      userId: "user-id",
      agentId: "agent-id",
      messages,
    });
    const body = await result.toUIMessageStreamResponse({
      originalMessages: messages,
    }).text();

    expect(researchModel.doStreamCalls).toHaveLength(1);
    expect(writerModel.doStreamCalls).toHaveLength(1);
    expect(body).not.toContain("RESEARCH_ONLY");
    expect(body).toContain("WRITER_ONLY");
    expect(extractionModel).toBe(writerModel);
    expect(mocks.resolveUserLanguageModel).not.toHaveBeenCalled();
    expect(writerModel.doStreamCalls[0].prompt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "assistant" }),
      ]),
    );
  });

  it("uses the Thinking model for the final pass when Humanizer is off", async () => {
    const thinkingModel = streamingModel(
      "google",
      "thinking",
      "THINKING_FINAL",
    );
    const humanizerModel = streamingModel(
      "humanizer-provider",
      "humanizer",
      "SHOULD_NOT_RUN",
    );
    mocks.resolveWorkspaceResearchModel.mockResolvedValue({
      providerId: "google",
      modelId: "thinking",
      model: thinkingModel,
    });
    mocks.resolveWorkspaceHumanizerModel.mockResolvedValue({
      providerId: "humanizer-provider",
      modelId: "humanizer",
      model: humanizerModel,
    });

    const { result } = await streamCompanyChat({
      chatId: "chat-id",
      userId: "user-id",
      agentId: "agent-id",
      messages,
      humanizerEnabled: false,
    });
    const body = await result.toUIMessageStreamResponse({
      originalMessages: messages,
    }).text();

    expect(thinkingModel.doStreamCalls).toHaveLength(2);
    expect(humanizerModel.doStreamCalls).toHaveLength(0);
    expect(mocks.resolveWorkspaceHumanizerModel).not.toHaveBeenCalled();
    expect(body).toContain("THINKING_FINAL");
  });

  it("uses the original single-model stream when the research role is unset", async () => {
    const writerModel = streamingModel("writer-provider", "writer", "FALLBACK_ANSWER");
    mocks.resolveUserLanguageModel.mockResolvedValue({
      providerId: "writer-provider",
      modelId: "writer",
      model: writerModel,
    });
    mocks.resolveWorkspaceResearchModel.mockResolvedValue(null);

    const { result } = await streamCompanyChat({
      chatId: "chat-id",
      userId: "user-id",
      agentId: "agent-id",
      messages,
      humanizerEnabled: false,
    });
    const body = await result.toUIMessageStreamResponse({
      originalMessages: messages,
    }).text();

    expect(writerModel.doStreamCalls).toHaveLength(1);
    expect(body).toContain("FALLBACK_ANSWER");
  });

  it("uses the Thinking model as the Humanizer fallback when no end model is configured", async () => {
    const thinkingModel = streamingModel("google", "gemini", "GOOGLE_HUMANIZED");
    mocks.resolveWorkspaceResearchModel.mockResolvedValue({
      providerId: "google",
      modelId: "gemini",
      model: thinkingModel,
    });
    mocks.resolveWorkspaceHumanizerModel.mockResolvedValue(null);

    const { result } = await streamCompanyChat({
      chatId: "chat-id",
      userId: "user-id",
      agentId: "agent-id",
      messages,
      humanizerEnabled: true,
    });
    const body = await result.toUIMessageStreamResponse({
      originalMessages: messages,
    }).text();

    expect(thinkingModel.doStreamCalls).toHaveLength(2);
    expect(body).toContain("GOOGLE_HUMANIZED");
    expect(thinkingModel.doStreamCalls[1].prompt).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "system" }),
      ]),
    );
  });
});
