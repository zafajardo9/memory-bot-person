import { GoogleGenAI } from "@google/genai";

import { getProviderApiKey } from "@/ai/providers/service";

export const KNOWLEDGE_EMBEDDING_MODEL = "gemini-embedding-2";
export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 768;

let client: GoogleGenAI | undefined;
let clientKey: string | undefined;
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

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

async function getClient() {
  const apiKey = await getProviderApiKey("google");
  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

async function embed(text: string) {
  try {
    const response = await (await getClient()).models.embedContent({
      model: KNOWLEDGE_EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: KNOWLEDGE_EMBEDDING_DIMENSIONS },
    });
    const values = response.embeddings?.[0]?.values;

    if (!values || values.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
      throw new Error("The embedding provider returned an invalid vector");
    }

    return values;
  } catch (error) {
    const allowFallback =
      process.env.KNOWLEDGE_ALLOW_LOCAL_EMBEDDINGS === "true" ||
      process.env.NODE_ENV !== "production";
    if (!allowFallback) throw error;

    if (!warnedAboutFallback) {
      console.warn(
        "Gemini embeddings are unavailable; using the development-only local embedding fallback.",
      );
      warnedAboutFallback = true;
    }
    return localEmbedding(text);
  }
}

export function embedKnowledgeDocument(text: string, title: string) {
  return embed(`Represent this approved company knowledge for employee retrieval.\nTitle: ${title}\nContent: ${text}`);
}

export function embedKnowledgeQuery(query: string) {
  return embed(`Represent this employee question for retrieving relevant company knowledge.\nQuestion: ${query}`);
}
