import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/memory-queries", () => ({
  MEMORY_CATEGORIES: ["fact", "preference", "context", "note"],
  saveUserMemory: vi.fn(),
}));

import {
  highConfidenceMemories,
  latestCompletedExchange,
} from "../../../ai/memory/extraction";

import type { UIMessage } from "ai";

describe("automatic memory extraction helpers", () => {
  it("selects the latest completed user and assistant text exchange", () => {
    const messages: UIMessage[] = [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Old message" }],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Old response" }],
      },
      {
        id: "u2",
        role: "user",
        parts: [{ type: "text", text: "Please call me Zac." }],
      },
      {
        id: "a2",
        role: "assistant",
        parts: [{ type: "text", text: "Understood." }],
      },
    ];

    expect(latestCompletedExchange(messages)).toEqual({
      userMessage: "Please call me Zac.",
      assistantResponse: "Understood.",
    });
  });

  it("keeps only extraction candidates at or above the confidence threshold", () => {
    const base = {
      title: "Name",
      content: "Prefers Zac",
      tags: [],
      category: "preference" as const,
      priority: 5,
    };
    expect(
      highConfidenceMemories([
        { ...base, confidence: 0.84 },
        { ...base, title: "Certain", confidence: 0.85 },
      ]).map((candidate) => candidate.title),
    ).toEqual(["Certain"]);
  });
});
