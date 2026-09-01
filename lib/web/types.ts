export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
  /** Label of the provider that returned this result (e.g. "Tavily"). */
  source?: string;
}

export interface WebSearchOptions {
  /** How thorough the search should be: "basic" (balanced) or "advanced" (higher precision). */
  searchDepth?: "basic" | "advanced";
  /** Restrict results to a relative recency window. */
  timeRange?: "day" | "week" | "month" | "year";
  /** Only return results from these domains (e.g. ["github.com", "arxiv.org"]). */
  includeDomains?: string[];
  /** Exclude results from these domains (e.g. ["reddit.com"]). */
  excludeDomains?: string[];
}

export interface WebSearchProvider {
  id: string;
  label: string;
  environmentKey: string;
  search: (
    query: string,
    maxResults: number,
    options?: WebSearchOptions,
  ) => Promise<WebSearchResult[]>;
}
