export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface WebSearchProvider {
  id: string;
  label: string;
  environmentKey: string;
  search: (query: string, maxResults: number) => Promise<WebSearchResult[]>;
}

