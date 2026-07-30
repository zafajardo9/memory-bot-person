import { describe, expect, it } from "vitest";

import { normalizeChatMarkdown } from "@/lib/ai/chat-markdown";

describe("normalizeChatMarkdown", () => {
  it("removes leaked reasoning wrappers and model labels", () => {
    expect(
      normalizeChatMarkdown(
        "Assistant: <think>private reasoning</think>\n\nHere is the answer.",
      ),
    ).toBe("Here is the answer.");
  });

  it("normalizes model-generated bullets and excess whitespace", () => {
    expect(
      normalizeChatMarkdown(
        "Key points:\r\n\r\n\r\n• First point  \r\n● Second point\r\n",
      ),
    ).toBe("Key points:\n\n- First point\n- Second point");
  });

  it("preserves safe Markdown links and citations", () => {
    const content =
      "Read [the full story](https://example.com). 【Notebook — Stories】";

    expect(normalizeChatMarkdown(content)).toBe(content);
  });
});
