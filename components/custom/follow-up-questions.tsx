"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

interface FollowUpResponse {
  questions?: unknown;
}

export function FollowUpQuestions({
  assistantMessage,
  messageId,
  onSelect,
  userMessage,
}: {
  assistantMessage: string;
  messageId: string;
  onSelect: (question: string) => Promise<void>;
  userMessage: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const { data: questions = [], isLoading } = useSWR<string[]>(
    ["follow-up-questions", messageId],
    async () => {
      const response = await fetch("/api/chat/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantMessage, userMessage }),
      });
      if (!response.ok) throw new Error("Unable to load follow-up questions");

      const result = (await response.json()) as FollowUpResponse;
      return Array.isArray(result.questions)
        ? result.questions
            .filter(
              (question): question is string => typeof question === "string",
            )
            .slice(0, 3)
        : [];
    },
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );

  if (dismissed) return null;

  return (
    <section aria-label="Suggested follow-up questions" className="mt-1">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Sparkles size={12} aria-hidden="true" />
        Ask next
      </div>

      <div className="flex flex-wrap gap-2">
        {isLoading
          ? [72, 104, 88].map((width) => (
              <div
                key={width}
                aria-hidden="true"
                className="h-8 animate-pulse rounded-full bg-muted"
                style={{ width }}
              />
            ))
          : questions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => {
                  setDismissed(true);
                  void onSelect(question);
                }}
                className="max-w-full rounded-full border bg-background px-3 py-1.5 text-left text-xs leading-5 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {question}
              </button>
            ))}
      </div>
    </section>
  );
}
