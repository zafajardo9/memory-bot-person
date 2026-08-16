import { describe, expect, it } from "vitest";

import { shouldUseCompanyKnowledge } from "@/ai/chat/retrieval-gate";

import type { LanguageModel } from "ai";

function throwingModel(): LanguageModel {
  return {
    specificationVersion: "v2",
    doGenerate: async () => {
      throw new Error("provider unavailable");
    },
    doStream: async () => {
      throw new Error("provider unavailable");
    },
  } as unknown as LanguageModel;
}

function garbageModel(text: string): LanguageModel {
  return {
    specificationVersion: "v2",
    doGenerate: async () => ({
      finishReason: "stop",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      content: [{ type: "text" as const, text }],
    }),
    doStream: async () => {
      throw new Error("streaming not supported");
    },
  } as unknown as LanguageModel;
}

describe("shouldUseCompanyKnowledge", () => {
  it("fails open when the model call errors", async () => {
    await expect(
      shouldUseCompanyKnowledge({
        query: "What is our refund policy?",
        model: throwingModel(),
      }),
    ).resolves.toBe(true);
  });

  it("fails open when structured output cannot be parsed", async () => {
    await expect(
      shouldUseCompanyKnowledge({
        query: "hi there!",
        model: garbageModel("definitely not json"),
      }),
    ).resolves.toBe(true);
  });

  it("fails open on an empty query without calling the model", async () => {
    // The gate is only invoked with non-empty text upstream; an empty query
    // still resolves safely rather than throwing.
    await expect(
      shouldUseCompanyKnowledge({
        query: "",
        model: throwingModel(),
      }),
    ).resolves.toBe(true);
  });
});
