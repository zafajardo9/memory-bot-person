import { describe, expect, it } from "vitest";

import { chunkSections, estimateTokenCount } from "../../../lib/knowledge/chunking";

describe("chunkSections", () => {
  it("preserves source metadata and creates bounded chunks", () => {
    const content = Array.from({ length: 30 }, (_, index) => `Paragraph ${index}: ${"work ".repeat(30)}`).join(
      "\n\n",
    );
    const chunks = chunkSections([
      { content, section: "Outline Work", pageNumber: 2, sourceUrl: "https://example.com/work" },
    ]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.section === "Outline Work")).toBe(true);
    expect(chunks.every((chunk) => chunk.pageNumber === 2)).toBe(true);
    expect(chunks.every((chunk) => chunk.tokenCount === estimateTokenCount(chunk.content))).toBe(true);
  });

  it("does not return empty chunks", () => {
    expect(chunkSections([{ content: "  " }])).toEqual([]);
  });
});
