import { loadMemoryPreflight } from "@/lib/memory/preflight";

import type { LanguageModelMiddleware } from "ai";

export function createMemoryMiddleware(
  userId: string,
  agentId?: string,
): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    transformParams: async ({ params }) => {
      try {
        const context = await loadMemoryPreflight(userId, agentId);
        if (!context) return params;

        const firstSystemIndex = params.prompt.findIndex(
          (message) => message.role === "system",
        );
        if (firstSystemIndex === -1) {
          return {
            ...params,
            prompt: [
              { role: "system", content: context },
              ...params.prompt,
            ],
          };
        }

        return {
          ...params,
          prompt: params.prompt.map((message, index) =>
            index === firstSystemIndex && message.role === "system"
              ? { ...message, content: `${message.content}\n\n${context}` }
              : message,
          ),
        };
      } catch (error) {
        console.error("User memory preflight failed", error);
        return params;
      }
    },
  };
}
