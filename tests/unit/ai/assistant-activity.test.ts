import { describe, expect, it } from "vitest";

import {
  describeToolInput,
  getToolPresentation,
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
