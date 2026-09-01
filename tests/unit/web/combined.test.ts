import { describe, expect, it, vi } from "vitest";

import { createCombinedProvider } from "../../../lib/web/combined";

import type { WebSearchProvider, WebSearchResult } from "../../../lib/web/types";

function stubProvider(id: string, results: WebSearchResult[]) {
  return {
    id,
    label: id,
    environmentKey: `KEY_${id.toUpperCase()}`,
    search: vi.fn().mockResolvedValue(results),
  } satisfies WebSearchProvider;
}

describe("combined web search provider", () => {
  it("merges results, dedupes by URL keeping the higher score, and orders by score", async () => {
    const combined = createCombinedProvider([
      stubProvider("Tavily", [
        {
          title: "Shared",
          url: "https://example.com/x",
          content: "low score",
          score: 0.8,
          source: "Tavily",
        },
        {
          title: "Only Tavily",
          url: "https://example.com/y",
          content: "second",
          score: 0.5,
          source: "Tavily",
        },
      ]),
      stubProvider("TinyFish", [
        {
          title: "Shared",
          url: "https://example.com/x",
          content: "high score",
          score: 0.9,
          source: "TinyFish",
        },
      ]),
    ]);

    const results = await combined.search("topic", 10);

    expect(results.map((result) => result.url)).toEqual([
      "https://example.com/x",
      "https://example.com/y",
    ]);
    expect(results[0]).toMatchObject({
      score: 0.9,
      source: "TinyFish",
      content: "high score",
    });
    expect(results[1]).toMatchObject({ score: 0.5, source: "Tavily" });
  });

  it("returns successful results when one provider fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const combined = createCombinedProvider([
      stubProvider("Tavily", [
        {
          title: "Survivor",
          url: "https://example.com/a",
          content: "still here",
          score: 0.7,
          source: "Tavily",
        },
      ]),
      {
        id: "TinyFish",
        label: "TinyFish",
        environmentKey: "TINYFISH_API_KEY",
        search: vi.fn().mockRejectedValue(new Error("provider down")),
      } satisfies WebSearchProvider,
    ]);

    const results = await combined.search("topic", 10);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Survivor");
    errorSpy.mockRestore();
  });

  it("fails the call when every provider fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const combined = createCombinedProvider([
      {
        id: "Tavily",
        label: "Tavily",
        environmentKey: "TAVILY_API_KEY",
        search: vi.fn().mockRejectedValue(new Error("down")),
      } satisfies WebSearchProvider,
      {
        id: "TinyFish",
        label: "TinyFish",
        environmentKey: "TINYFISH_API_KEY",
        search: vi.fn().mockRejectedValue(new Error("down")),
      } satisfies WebSearchProvider,
    ]);

    await expect(combined.search("topic", 10)).rejects.toThrow(
      "All configured web search providers failed.",
    );
    errorSpy.mockRestore();
  });

  it("applies the maxResults cap after merging", async () => {
    const combined = createCombinedProvider([
      stubProvider("Tavily", [
        {
          title: "a",
          url: "https://example.com/a",
          content: "a",
          score: 0.9,
          source: "Tavily",
        },
        {
          title: "b",
          url: "https://example.com/b",
          content: "b",
          score: 0.8,
          source: "Tavily",
        },
        {
          title: "c",
          url: "https://example.com/c",
          content: "c",
          score: 0.7,
          source: "Tavily",
        },
      ]),
    ]);

    const results = await combined.search("topic", 2);

    expect(results).toHaveLength(2);
  });

  it("rejects an empty provider list", () => {
    expect(() => createCombinedProvider([])).toThrow(
      "No web search providers were configured.",
    );
  });
});
