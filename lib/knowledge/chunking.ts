import type { ExtractedSection, KnowledgeChunkInput } from "./types";

const TARGET_CHARS = 1_600;
const OVERLAP_CHARS = 200;

export function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}

export function chunkSections(sections: ExtractedSection[]): KnowledgeChunkInput[] {
  const chunks: KnowledgeChunkInput[] = [];

  for (const section of sections) {
    const paragraphs = section.content
      .split(/\n{2,}/)
      .map((value) => value.trim())
      .filter(Boolean);
    let buffer = "";

    const pushChunk = () => {
      const content = buffer.trim();
      if (!content) return;
      chunks.push({ ...section, content, tokenCount: estimateTokenCount(content) });
      buffer = content.slice(-OVERLAP_CHARS);
    };

    for (const paragraph of paragraphs.length ? paragraphs : [section.content]) {
      if (buffer.length + paragraph.length + 2 > TARGET_CHARS && buffer.length > 0) {
        pushChunk();
      }

      if (paragraph.length > TARGET_CHARS) {
        for (let offset = 0; offset < paragraph.length; offset += TARGET_CHARS - OVERLAP_CHARS) {
          const content = paragraph.slice(offset, offset + TARGET_CHARS).trim();
          if (content) {
            chunks.push({ ...section, content, tokenCount: estimateTokenCount(content) });
          }
        }
        buffer = "";
      } else {
        buffer = `${buffer}\n\n${paragraph}`.trim();
      }
    }

    if (buffer.trim()) {
      chunks.push({
        ...section,
        content: buffer.trim(),
        tokenCount: estimateTokenCount(buffer.trim()),
      });
    }
  }

  return chunks;
}
