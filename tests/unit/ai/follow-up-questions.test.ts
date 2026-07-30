import { describe, expect, it } from "vitest";

import {
  curatedFollowUpQuestions,
  mergeFollowUpQuestions,
  normalizeFollowUpQuestions,
} from "@/lib/ai/follow-up-questions";

describe("follow-up questions", () => {
  it("normalizes, deduplicates, and limits generated questions", () => {
    expect(
      normalizeFollowUpQuestions([
        "1. What happens next",
        "What happens next?",
        "- Which source should I read.",
        "Can you show an example?",
        "A fourth question?",
      ]),
    ).toEqual([
      "What happens next?",
      "Which source should I read?",
      "Can you show an example?",
    ]);
  });

  it("creates Notebook-aware curated questions", () => {
    expect(
      curatedFollowUpQuestions(
        "The process is documented here. 【Onboarding — Access】",
      ),
    ).toEqual([
      "Which Notebook source should I review first?",
      "What should I do next based on this?",
      "Can you give me a concrete example?",
    ]);
  });

  it("fills incomplete generated results with curated fallbacks", () => {
    expect(
      mergeFollowUpQuestions(["What is the first step?"], [
        "What is the first step?",
        "What could go wrong?",
        "Who should I ask for help?",
      ]),
    ).toEqual([
      "What is the first step?",
      "What could go wrong?",
      "Who should I ask for help?",
    ]);
  });
});
