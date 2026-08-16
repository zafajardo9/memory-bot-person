/**
 * Citation bridge between the model's inline citation format and the UI.
 *
 * The assistant contract instructs models to cite company claims inline as
 * `【Title — section or page】`. This module turns those markers into numbered
 * markdown links (`kairo-citation:` scheme) and resolves them to evidence-card
 * anchors using the chunk ids already present in knowledge tool outputs.
 */

export const CITATION_SCHEME = "kairo-citation:";

const CITATION_PATTERN = /【([^】]{1,300})】/g;

export interface CitationTarget {
  /** Anchor id of the matching evidence card, when one exists. */
  chunkId?: string;
}

/** Normalized citation string -> anchor target. First occurrence wins. */
export type CitationRegistry = Map<string, CitationTarget>;

/** Evidence-card anchor id for a chunk, matching KnowledgeSourceCards. */
export function citationAnchorId(chunkId: string) {
  return `cite-${chunkId}`;
}

export function normalizeCitationKey(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Decode the normalized key carried in a `kairo-citation:` href. */
export function citationKeyFromHref(href: string) {
  if (!href.startsWith(CITATION_SCHEME)) return null;
  try {
    return normalizeCitationKey(decodeURIComponent(href.slice(CITATION_SCHEME.length)));
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectSearchOutput(output: unknown, add: (citation: string, chunkId?: string) => void) {
  // searchCompanyKnowledge output: { results: [{ chunkId, citation, title }] }
  if (!isRecord(output) || !Array.isArray(output.results)) return;
  for (const result of output.results) {
    if (!isRecord(result)) continue;
    if (typeof result.citation !== "string") continue;
    const chunkId = typeof result.chunkId === "string" ? result.chunkId : undefined;
    add(result.citation, chunkId);
  }
}

function collectReadOutput(output: unknown, add: (citation: string, chunkId?: string) => void) {
  // readCompanyKnowledge output: { sources: [{ citation, passages: [{ id }] }] }
  if (!isRecord(output) || !Array.isArray(output.sources)) return;
  for (const source of output.sources) {
    if (!isRecord(source) || typeof source.citation !== "string") continue;
    const passages = Array.isArray(source.passages) ? source.passages : [];
    const firstPassage = passages.find(isRecord);
    const chunkId =
      firstPassage && typeof firstPassage.id === "string" ? firstPassage.id : undefined;
    add(source.citation, chunkId);
  }
}

/**
 * Build the citation registry from a message's tool outputs in call order.
 * Accepts arbitrary tool outputs; only knowledge tool shapes contribute.
 */
export function buildCitationRegistry(toolOutputs: unknown[]): CitationRegistry {
  const registry: CitationRegistry = new Map();
  const add = (citation: string, chunkId?: string) => {
    const key = normalizeCitationKey(citation);
    if (!key) return;
    if (registry.has(key)) {
      // First chunk id wins; later duplicates would only move the anchor.
      const existing = registry.get(key);
      if (existing?.chunkId || !chunkId) return;
    }
    registry.set(key, { chunkId });
  };

  for (const output of toolOutputs) {
    collectSearchOutput(output, add);
    collectReadOutput(output, add);
  }
  return registry;
}

/**
 * Replace `【…】` markers with numbered `kairo-citation:` markdown links.
 * Numbers follow first appearance in the text, so they stay stable while the
 * answer streams (text only appends). Chip targets are resolved at render
 * time from the registry, so unregistered citations still render as inert
 * chips.
 */
export function applyCitationMarkup(content: string) {
  const numbers = new Map<string, number>();
  return content.replace(CITATION_PATTERN, (_match, rawCitation: string) => {
    const key = normalizeCitationKey(rawCitation);
    let number = numbers.get(key);
    if (number === undefined) {
      number = numbers.size + 1;
      numbers.set(key, number);
    }
    return `[${number}](${CITATION_SCHEME}${encodeURIComponent(key)})`;
  });
}
