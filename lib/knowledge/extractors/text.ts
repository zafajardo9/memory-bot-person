import type { ExtractedDocument, ExtractedSection } from "../types";

export function extractStructuredText(text: string, sourceUrl?: string): ExtractedDocument {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  const lines = normalized.split("\n");
  const sections: ExtractedSection[] = [];
  let currentHeading: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content) {
      sections.push({ content, section: currentHeading, sourceUrl });
    }
    buffer = [];
  };

  for (const line of lines) {
    const markdownHeading = line.match(/^#{1,6}\s+(.+)$/);
    const outlineHeading = line.match(/^([A-Z][A-Za-z0-9 &/()-]{2,80}):\s*$/);

    if (markdownHeading || outlineHeading) {
      flush();
      currentHeading = (markdownHeading?.[1] ?? outlineHeading?.[1])?.trim();
    } else {
      buffer.push(line);
    }
  }

  flush();

  if (sections.length === 0 && normalized) {
    sections.push({ content: normalized, sourceUrl });
  }

  return { sections };
}
