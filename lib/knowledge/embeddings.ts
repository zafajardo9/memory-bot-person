import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { embed as createEmbedding } from "ai";

import { resolveKnowledgeEmbeddingEngine } from "./embedding-settings";

export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 768;

export type KnowledgeEmbeddingEngine = Awaited<
  ReturnType<typeof resolveKnowledgeEmbeddingEngine>
>;

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

async function embed(
  text: string,
  task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  engine: KnowledgeEmbeddingEngine,
) {
  try {
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
  } catch (error) {
    const allowFallback =
      process.env.KNOWLEDGE_ALLOW_LOCAL_EMBEDDINGS === "true" ||
      process.env.NODE_ENV !== "production";
    if (!allowFallback) throw error;

    if (!warnedAboutFallback) {
      console.warn(
        `${engine.providerLabel} embeddings are unavailable; using the development-only local embedding fallback.`,
      );
      warnedAboutFallback = true;
    }
    return localEmbedding(text);
  }
}

export function embedKnowledgeDocument(
  text: string,
  title: string,
  engine: KnowledgeEmbeddingEngine,
) {
  return embed(
    `Represent this approved company knowledge for employee retrieval.\nTitle: ${title}\nContent: ${text}`,
    "RETRIEVAL_DOCUMENT",
    engine,
  );
}

export function embedKnowledgeQuery(
  query: string,
  engine: KnowledgeEmbeddingEngine,
) {
  return embed(
    `Represent this employee question for retrieving relevant company knowledge.\nQuestion: ${query}`,
    "RETRIEVAL_QUERY",
    engine,
  );
}
