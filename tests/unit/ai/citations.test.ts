import { describe, expect, it } from "vitest";

import {
  CITATION_SCHEME,
  applyCitationMarkup,
  buildCitationRegistry,
  citationAnchorId,
  citationKeyFromHref,
  normalizeCitationKey,
} from "@/lib/ai/citations";

describe("normalizeCitationKey", () => {
  it("collapses whitespace and lowercases for stable matching", () => {
    expect(normalizeCitationKey("  Onboarding   Guide — page 3 ")).toBe(
      "onboarding guide — page 3",
    );
  });
});

describe("buildCitationRegistry", () => {
  it("maps search result citations to chunk ids", () => {
    const registry = buildCitationRegistry([
      {
        queryLogId: "log-1",
        results: [
          { chunkId: "chunk-a", citation: "Onboarding — page 3", title: "Onboarding" },
          { chunkId: "chunk-b", citation: "Security Policy — Access", title: "Security Policy" },
        ],
      },
    ]);

    expect(registry.get(normalizeCitationKey("onboarding — page 3"))).toEqual({
      chunkId: "chunk-a",
    });
    expect(registry.get(normalizeCitationKey("SECURITY POLICY — ACCESS"))).toEqual({
      chunkId: "chunk-b",
    });
  });

  it("maps read passages through the first passage chunk id", () => {
    const registry = buildCitationRegistry([
      {
        sources: [
          {
            citation: "Handbook — section 2",
            passages: [{ id: "chunk-x" }, { id: "chunk-y" }],
          },
        ],
      },
    ]);

    expect(registry.get(normalizeCitationKey("Handbook — section 2"))).toEqual({
      chunkId: "chunk-x",
    });
  });

  it("keeps the first chunk id when a citation repeats across searches", () => {
    const registry = buildCitationRegistry([
      {
        results: [
          { chunkId: "first", citation: "Guide — page 1" },
        ],
      },
      {
        results: [
          { chunkId: "second", citation: "guide — Page 1" },
        ],
      },
    ]);

    expect(registry.get(normalizeCitationKey("Guide — page 1"))).toEqual({
      chunkId: "first",
    });
  });

  it("ignores unrelated and malformed outputs", () => {
    const registry = buildCitationRegistry([
      undefined,
      null,
      "text",
      { results: "not-an-array" },
      { results: [{ citation: "No chunk id" }] },
      { sources: [{ passages: [{ id: "orphan" }] }] },
    ]);

    expect(registry.get(normalizeCitationKey("No chunk id"))).toEqual({ chunkId: undefined });
    expect(registry.size).toBe(1);
  });
});

describe("applyCitationMarkup", () => {
  it("numbers citations by first appearance", () => {
    const markup = applyCitationMarkup(
      "Policy says yes 【Alpha — page 1】 and also 【Beta — section 2】, restated 【Alpha — page 1】.",
    );

    expect(markup).toContain(`[1](${CITATION_SCHEME}${encodeURIComponent("alpha — page 1")})`);
    expect(markup).toContain(`[2](${CITATION_SCHEME}${encodeURIComponent("beta — section 2")})`);
    expect(markup).not.toContain("【");
  });

  it("ignores an unclosed citation while streaming", () => {
    const markup = applyCitationMarkup("Still thinking 【Alpha — page");
    expect(markup).toBe("Still thinking 【Alpha — page");
  });

  it("round-trips keys through the href scheme", () => {
    const markup = applyCitationMarkup("Cite 【Alpha — page 1】 now.");
    const href = markup.match(/\]\(([^)]+)\)/)?.[1] ?? "";
    const registry = buildCitationRegistry([
      { results: [{ chunkId: "chunk-a", citation: "alpha — Page 1" }] },
    ]);

    const key = citationKeyFromHref(href);
    expect(key).not.toBeNull();
    expect(registry.get(key!)).toEqual({ chunkId: "chunk-a" });
    expect(citationAnchorId("chunk-a")).toBe("cite-chunk-a");
  });

  it("rejects foreign hrefs", () => {
    expect(citationKeyFromHref("https://example.com")).toBeNull();
    expect(citationKeyFromHref(`${CITATION_SCHEME}%E0%A4%A`)).toBeNull();
  });
});
