import { describe, expect, it } from "vitest";

import { knowledgeSearchSchema } from "@/lib/knowledge/validation";

describe("knowledgeSearchSchema", () => {
  it("defaults to an unfiltered bounded retrieval", () => {
    expect(knowledgeSearchSchema.parse({ query: "benefits policy" })).toEqual({
      query: "benefits policy",
      limit: 8,
      tags: [],
    });
  });

  it("normalizes tag filters and accepts a source type", () => {
    expect(
      knowledgeSearchSchema.parse({
        query: "onboarding",
        tags: [" People ", "HR"],
        sourceType: "FILE",
      }),
    ).toMatchObject({
      tags: ["people", "hr"],
      sourceType: "FILE",
    });
  });
});
