import type {
  WebSearchOptions,
  WebSearchProvider,
  WebSearchResult,
} from "./types";

function urlKey(url: string) {
  try {
    return new URL(url).href.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url;
  }
}

/**
 * Merges results from several providers into one labeled, deduplicated list.
 *
 * - Providers run in parallel; one failing provider does not fail the call.
 * - Duplicate URLs keep the result with the higher score.
 * - Results are ordered by score descending and capped at `maxResults`.
 */
export function createCombinedProvider(
  providers: WebSearchProvider[],
): WebSearchProvider {
  if (providers.length === 0) {
    throw new Error("No web search providers were configured.");
  }

  return {
    id: "combined",
    label: "Combined",
    environmentKey: "WEB_SEARCH_PROVIDER",
    async search(query, maxResults, options?: WebSearchOptions) {
      const outcomes = await Promise.allSettled(
        providers.map((provider) =>
          provider.search(query, maxResults, options),
        ),
      );

      const seen = new Map<string, WebSearchResult>();
      let failures = 0;
      outcomes.forEach((outcome, index) => {
        if (outcome.status === "rejected") {
          failures += 1;
          console.error(
            `[web-search] ${providers[index].label} failed:`,
            outcome.reason,
          );
          return;
        }
        for (const result of outcome.value) {
          const key = urlKey(result.url);
          const current = seen.get(key);
          if (!current || (result.score ?? 0) > (current.score ?? 0)) {
            seen.set(key, result);
          }
        }
      });

      if (failures === providers.length) {
        throw new Error("All configured web search providers failed.");
      }

      return [...seen.values()]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, maxResults);
    },
  };
}
