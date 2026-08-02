export interface ExtractedSection {
  content: string;
  section?: string;
  pageNumber?: number;
  sourceUrl?: string;
}

export interface ExtractedDocument {
  title?: string;
  sections: ExtractedSection[];
  discoveredLinks?: string[];
  metadata?: Record<string, unknown>;
}

export interface KnowledgeChunkInput extends ExtractedSection {
  content: string;
  tokenCount: number;
  embeddingText: string;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  sourceId: string;
  versionId: string;
  title: string;
  content: string;
  section: string | null;
  pageNumber: number | null;
  sourceUrl: string | null;
  score: number;
  citation: string;
}

export interface KnowledgeSearchOutcome {
  results: KnowledgeSearchResult[];
  queryLogId: string;
}
