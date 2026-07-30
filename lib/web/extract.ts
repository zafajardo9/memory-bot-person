import { extractWebPage } from "@/lib/knowledge/extractors/web-page";
import { fetchPublicKnowledgeUrl } from "@/lib/knowledge/url-security";

import { webPageContentLimit } from "./config";

const TEXT_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

export function extractReadableWebContent(
  bytes: Uint8Array,
  contentType: string,
  url: string,
) {
  if (!TEXT_CONTENT_TYPES.has(contentType)) {
    throw new Error("This page is not a supported text or HTML document.");
  }

  const decoded = new TextDecoder().decode(bytes);
  const content =
    contentType === "text/html" || contentType === "application/xhtml+xml"
      ? extractWebPage(decoded, url).sections
          .map((section) =>
            section.section
              ? `${section.section}\n${section.content}`
              : section.content,
          )
          .join("\n\n")
      : decoded.trim();

  if (!content) throw new Error("No readable content was found on this page.");

  const limit = webPageContentLimit();
  return {
    content: content.slice(0, limit),
    truncated: content.length > limit,
  };
}

export async function fetchAndExtractWebPage(value: string) {
  const response = await fetchPublicKnowledgeUrl(value);
  return {
    url: response.url,
    ...extractReadableWebContent(
      response.bytes,
      response.contentType,
      response.url,
    ),
  };
}

