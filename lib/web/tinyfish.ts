import { RateLimitError, TinyFish } from "@tiny-fish/sdk";

import type { WebSearchOptions, WebSearchProvider, WebSearchResult } from "./types";
import type { SearchQueryParams } from "@tiny-fish/sdk";

const TIME_RANGE_TO_RECENCY_MINUTES: Record<string, number> = {
  day: 1440,
  week: 10_080,
  month: 43_200,
  year: 525_600,
};

const SEARCH_TIMEOUT_MS = 15_000;

export function createTinyFishProvider(apiKey: string): WebSearchProvider {
  const key = apiKey.trim();
  if (!key) throw new Error("TinyFish is not configured.");

  const client = new TinyFish({
    apiKey: key,
    timeout: SEARCH_TIMEOUT_MS,
    // Match the Tavily provider: fail fast and predictably instead of retrying.
    maxRetries: 0,
  });

  return {
    id: "tinyfish",
    label: "TinyFish",
    environmentKey: "TINYFISH_API_KEY",
    async search(query, maxResults, options) {
      const params: SearchQueryParams = { query };
      if (options?.timeRange) {
        const recencyMinutes = TIME_RANGE_TO_RECENCY_MINUTES[options.timeRange];
        if (recencyMinutes) params.recency_minutes = recencyMinutes;
      }
      if (options?.includeDomains?.length) {
        params.include_domains = options.includeDomains.join(",");
      }
      if (options?.excludeDomains?.length) {
        params.exclude_domains = options.excludeDomains.join(",");
      }

      try {
        const response = await client.search.query(params);
        return response.results.slice(0, maxResults).map(
          (result): WebSearchResult => ({
            title: result.title,
            url: result.url,
            content: result.snippet,
            // TinyFish does not return a relevance score; derive one from rank.
            score: 1 - result.position / 10,
            source: "TinyFish",
            ...(result.date ? { publishedDate: result.date } : {}),
          }),
        );
      } catch (error) {
        if (error instanceof RateLimitError) {
          throw new Error("Web search quota is temporarily exhausted.");
        }
        console.error("[web-search] TinyFish request failed:", error);
        throw new Error("The web search provider request failed.");
      }
    },
  };
}
