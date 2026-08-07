import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { embed as createEmbedding } from "ai";

import type { KnowledgeEmbeddingEngine } from "./embedding-settings";

export type { KnowledgeEmbeddingEngine } from "./embedding-settings";

export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 768;

export type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

let warnedAboutFallback = false;

function localEmbedding(text: string) {
  const vector = Array<number>(KNOWLEDGE_EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];

  for (const token of tokens) {
    let hash = 2166136261;
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const position = Math.abs(hash) % KNOWLEDGE_EMBEDDING_DIMENSIONS;
    vector[position] += hash % 2 === 0 ? 1 : -1;
  }

  const magnitude =
    Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function embeddingModel(engine: KnowledgeEmbeddingEngine) {
  if (engine.providerId === "openai") {
    return createOpenAI({ apiKey: engine.apiKey }).embedding(engine.modelId);
  }
  return createGoogleGenerativeAI({ apiKey: engine.apiKey }).embedding(
    engine.modelId,
  );
}

/** One embedding attempt against a single engine — no fallback here. */
async function embed(
  text: string,
  task: EmbeddingTask,
  engine: KnowledgeEmbeddingEngine,
) {
  if (engine.providerId === "huggingface") {
    return embedWithHuggingFace(text, engine);
  }

  const result = await createEmbedding({
    model: embeddingModel(engine),
    value: text,
    providerOptions:
      engine.providerId === "openai"
        ? { openai: { dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS } }
        : {
            google: {
              outputDimensionality: KNOWLEDGE_EMBEDDING_DIMENSIONS,
              taskType: task,
            },
          },
  });

  if (result.embedding.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
    throw new Error("The embedding provider returned an invalid vector");
  }
  return result.embedding;
}

/**
 * Hugging Face hosted embeddings via the Inference API
 * (feature-extraction). The first call can take several seconds while the
 * model loads onto a replica (503 + estimated_time); it is retried with a
 * bounded backoff, then fails over to the next configured provider.
 */
async function embedWithHuggingFace(
  text: string,
  engine: KnowledgeEmbeddingEngine,
) {
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(
    engine.modelId,
  )}`;
  const headers = {
    Authorization: `Bearer ${engine.apiKey}`,
    "Content-Type": "application/json",
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: text }),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });

    if (response.status === 503) {
      const body = (await response.json().catch(() => null)) as {
        estimated_time?: number;
      } | null;
      const delayMs = Math.min((body?.estimated_time ?? 10) * 1000, 15_000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      throw new Error(
        `Hugging Face embedding failed (${response.status}): ${detail}`,
      );
    }

    const data = (await response.json()) as number[];
    if (!Array.isArray(data) || data.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
      throw new Error("Hugging Face returned an invalid embedding vector");
    }
    return data;
  }

  throw new Error(
    "Hugging Face embedding timed out waiting for the model to load.",
  );
}

function localOrThrow(text: string, lastError: unknown) {
  const allowFallback =
    process.env.KNOWLEDGE_ALLOW_LOCAL_EMBEDDINGS === "true" ||
    process.env.NODE_ENV !== "production";
  if (!allowFallback) {
    throw lastError instanceof Error
      ? lastError
      : new Error(
          "All embedding providers failed. Check provider status in AI settings.",
        );
  }

  if (!warnedAboutFallback) {
    console.warn(
      "All configured embedding providers are unavailable; using the development-only local embedding fallback.",
    );
    warnedAboutFallback = true;
  }
  return localEmbedding(text);
}

/**
 * Tries each configured embedding engine in order — the active provider first,
 * then any other connected and enabled provider — so one provider's free-tier
 * rate limit no longer blocks knowledge processing. Falls back to dev-only
 * local hashing (or throws in production) when every provider fails.
 */
async function embedWithProviderList(
  text: string,
  task: EmbeddingTask,
  engines: KnowledgeEmbeddingEngine[],
): Promise<{ embedding: number[]; engine: KnowledgeEmbeddingEngine | null }> {
  let lastError: unknown;
  for (const engine of engines) {
    try {
      return { embedding: await embed(text, task, engine), engine };
    } catch (error) {
      lastError = error;
      console.warn(
        `${engine.providerLabel} embedding failed (${error instanceof Error ? error.message : error}); trying the next configured provider.`,
      );
    }
  }
  return { embedding: localOrThrow(text, lastError), engine: null };
}

export async function embedKnowledgeDocument(
  text: string,
  title: string,
  engines: KnowledgeEmbeddingEngine[],
) {
  const { embedding } = await embedWithProviderList(
    `Represent this approved company knowledge for employee retrieval.\nTitle: ${title}\nContent: ${text}`,
    "RETRIEVAL_DOCUMENT",
    engines,
  );
  return embedding;
}

export async function embedKnowledgeQuery(
  query: string,
  engines: KnowledgeEmbeddingEngine[],
): Promise<{ embedding: number[]; storageModelId: string | null }> {
  const { embedding, engine } = await embedWithProviderList(
    `Represent this employee question for retrieving relevant company knowledge.\nQuestion: ${query}`,
    "RETRIEVAL_QUERY",
    engines,
  );
  // Retrieval must restrict the index to the model that actually produced this
  // query vector, so it matches correctly even after provider failover.
  return { embedding, storageModelId: engine?.storageModelId ?? null };
}

/**
 * Picks the engine a whole ingestion job should use by probing with the first
 * chunk. Choosing once per job keeps every vector in a single provider's space
 * (mixed models would break semantic retrieval). Returns null when every
 * provider fails, letting the per-call path apply its local/throw fallback.
 */
export async function pickKnowledgeEmbeddingEngine(
  engines: KnowledgeEmbeddingEngine[],
  probeText: string,
  task: EmbeddingTask,
): Promise<{ engine: KnowledgeEmbeddingEngine; embedding: number[] } | null> {
  let lastError: unknown;
  for (const engine of engines) {
    try {
      return { engine, embedding: await embed(probeText, task, engine) };
    } catch (error) {
      lastError = error;
      console.warn(
        `${engine.providerLabel} embedding failed (${error instanceof Error ? error.message : error}); trying the next configured provider.`,
      );
    }
  }
  console.error("All embedding providers failed", lastError);
  return null;
}
