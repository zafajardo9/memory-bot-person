import { describe, expect, it } from "vitest";

import { parseAgentBrowserReadResponse } from "@/lib/web/agent-browser-response";

describe("Agent Browser integration", () => {
  it("parses and bounds rendered page output", () => {
    const result = parseAgentBrowserReadResponse(
      JSON.stringify({
        success: true,
        error: null,
        data: {
          content: "Rendered JavaScript content",
          contentType: "text/html",
          finalUrl: "https://example.com/article",
          source: "active-tab-html",
          truncated: false,
        },
      }),
      12,
    );

    expect(result).toEqual({
      content: "Rendered Jav",
      contentType: "text/html",
      source: "active-tab-html",
      truncated: true,
      url: "https://example.com/article",
    });
  });

  it("fails closed when the CLI reports an error", () => {
    expect(() =>
      parseAgentBrowserReadResponse(
        JSON.stringify({
          success: false,
          error: { message: "Navigation blocked" },
        }),
        12_000,
      ),
    ).toThrow("Navigation blocked");
  });
});
