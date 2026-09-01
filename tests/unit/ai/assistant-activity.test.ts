import { describe, expect, it } from "vitest";

import {
  describeToolInput,
  getActivityHeader,
  getToolActivityState,
  getToolPresentation,
  reasoningPartToStep,
  toolPartToStep,
} from "../../../components/custom/assistant-activity";
import { getSubmissionMode } from "../../../components/custom/chat";

describe("assistant activity hierarchy", () => {
  it("uses plain-language labels for web, file, and memory work", () => {
    expect(getToolPresentation("webSearch").activeLabel).toBe(
      "Searching the web",
    );
    expect(getToolPresentation("searchPersonalFiles").completeLabel).toBe(
      "Searched your files",
    );
    expect(getToolPresentation("saveUserMemory").completeLabel).toBe(
      "Saved to memory",
    );
    expect(getToolPresentation("browseWebPage").activeLabel).toBe(
      "Rendering a web page",
    );
  });

  it("turns tool inputs into concise user-facing context", () => {
    expect(
      describeToolInput("webSearch", { query: "AI SDK 7 release notes" }),
    ).toBe("“AI SDK 7 release notes”");
    expect(
      describeToolInput("readWebPage", {
        url: "https://www.example.com/guide",
      }),
    ).toBe("example.com");
    expect(
      describeToolInput("browseWebPage", {
        url: "https://app.example.com/dashboard",
      }),
    ).toBe("app.example.com");
    expect(
      describeToolInput("searchPersonalFiles", {
        query: "quarterly plan",
      }),
    ).toBe("“quarterly plan”");
  });

  it("creates a readable fallback for future tools", () => {
    expect(getToolPresentation("analyzeDocument").activeLabel).toBe(
      "Using analyze document",
    );
  });

  it("maps AI SDK tool states to semantic chip statuses", () => {
    expect(
      getToolActivityState({ state: "input-streaming" } as never),
    ).toEqual({ label: "Preparing", tone: "active" });
    expect(
      getToolActivityState({ state: "approval-requested" } as never),
    ).toEqual({ label: "Needs approval", tone: "waiting" });
    expect(
      getToolActivityState({ state: "output-error" } as never),
    ).toEqual({ label: "Failed", tone: "error" });
  });

  it("builds stable live steps from dynamic and repeated tool calls", () => {
    const first = toolPartToStep({
      type: "dynamic-tool",
      toolName: "webSearch",
      toolCallId: "search-1",
      state: "input-available",
      input: { query: "foundation css" },
    } as never);
    const second = toolPartToStep({
      type: "dynamic-tool",
      toolName: "webSearch",
      toolCallId: "search-2",
      state: "output-available",
      input: { query: "tool chips" },
      output: { results: [] },
    } as never);

    expect(first).toMatchObject({
      id: "search-1",
      label: "Searching the web",
      chip: "“foundation css”",
      status: "active",
    });
    expect(second).toMatchObject({
      id: "search-2",
      label: "Searched the web",
      status: "done",
    });
  });

  it("turns reasoning into a concise expandable thinking step", () => {
    expect(
      reasoningPartToStep(
        {
          type: "reasoning",
          state: "streaming",
          text: "First inspect the current activity renderer.\nThen adapt it.",
        },
        0,
      ),
    ).toMatchObject({
      id: "reasoning-0",
      label: "Thinking",
      chip: "First inspect the current activity renderer.",
      status: "active",
    });
  });

  it("summarizes active and completed work for the chips header", () => {
    expect(
      getActivityHeader({
        isActive: true,
        researchingNow: true,
        totalSources: 2,
        toolCount: 1,
        reasoningCount: 1,
      }),
    ).toBe("Researching · 2 sources…");
    expect(
      getActivityHeader({
        isActive: false,
        researchingNow: false,
        totalSources: 1,
        toolCount: 2,
        reasoningCount: 1,
      }),
    ).toBe("2 tool calls, 1 thinking step · 1 source");
  });
});

describe("chat submission queue", () => {
  it("sends immediately while idle", () => {
    expect(
      getSubmissionMode({ isLoading: false, hasQueuedMessage: false }),
    ).toBe("send");
  });

  it("queues one message while an answer is generating", () => {
    expect(
      getSubmissionMode({ isLoading: true, hasQueuedMessage: false }),
    ).toBe("queue");
  });

  it("blocks another submission when the queue is occupied", () => {
    expect(
      getSubmissionMode({ isLoading: true, hasQueuedMessage: true }),
    ).toBe("blocked");
  });
});
