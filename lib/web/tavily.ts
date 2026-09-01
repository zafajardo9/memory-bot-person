import { z } from "zod";

import type { WebSearchOptions, WebSearchProvider } from "./types";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const SEARCH_TIMEOUT_MS = 15_000;

const tavilyResponseSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
      content: z.string(),
      score: z.number(),
      published_date: z.string().optional().nullable(),
    }),
  ),
});

export function createTavilyProvider(apiKey: string): WebSearchProvider {
  const key = apiKey.trim();
  if (!key) throw new Error("Tavily is not configured.");

  return {
    id: "tavily",
    label: "Tavily",
    environmentKey: "TAVILY_API_KEY",
    async search(query, maxResults, options) {
      const body: Record<string, unknown> = {
        query,
        max_results: maxResults,
        search_depth: options?.searchDepth ?? "basic",
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      };
      if (options?.timeRange) body.time_range = options.timeRange;
      if (options?.includeDomains?.length) {
        body.include_domains = options.includeDomains;
      }
      if (options?.excludeDomains?.length) {
        body.exclude_domains = options.excludeDomains;
      }

      const response = await fetch(TAVILY_SEARCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Web search quota is temporarily exhausted."
            : "The web search provider request failed.",
        );
      }

      const parsed = tavilyResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error("The web search provider returned an invalid response.");
      }

      return parsed.data.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
        source: "Tavily",
        ...(result.published_date
          ? { publishedDate: result.published_date }
          : {}),
      }));
    },
  };
}

