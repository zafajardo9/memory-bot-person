const MAX_QUESTION_LENGTH = 140;

function asQuestion(value: string) {
  const cleaned = value
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 4) return null;

  const withoutEnding = cleaned.replace(/[.!?]+$/, "");
  const shortened =
    withoutEnding.length <= MAX_QUESTION_LENGTH - 1
      ? withoutEnding
      : `${withoutEnding.slice(0, MAX_QUESTION_LENGTH - 2).trimEnd()}…`;

  return `${shortened}?`;
}

export function normalizeFollowUpQuestions(value: unknown) {
  if (!Array.isArray(value)) return [];

  const questions: string[] = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const question = asQuestion(candidate);
    if (!question) continue;

    const key = question.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push(question);

    if (questions.length === 3) break;
  }

  return questions;
}

export function curatedFollowUpQuestions(assistantText: string) {
  const candidates = [
    /【[^】]+】/.test(assistantText)
      ? "Which Notebook source should I review first?"
      : /steps?|process|workflow|procedure/i.test(assistantText)
        ? "Can you turn this into a short step-by-step checklist?"
        : "Can you summarize the key points in a short checklist?",
    /risk|trust|decision|compare|trade-?off/i.test(assistantText)
      ? "What risks or tradeoffs should I consider?"
      : "What should I do next based on this?",
    /couldn'?t find|unavailable|missing|unclear|gap/i.test(assistantText)
      ? "What information would help fill the remaining gaps?"
      : "Can you give me a concrete example?",
  ];

  return normalizeFollowUpQuestions(candidates);
}

export function mergeFollowUpQuestions(
  generated: unknown,
  fallback: string[],
) {
  return normalizeFollowUpQuestions([
    ...normalizeFollowUpQuestions(generated),
    ...fallback,
  ]);
}
