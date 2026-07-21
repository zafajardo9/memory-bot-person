import { load } from "cheerio";

import type { ExtractedDocument, ExtractedSection } from "../types";

export function extractWebPage(html: string, sourceUrl: string): ExtractedDocument {
  const $ = load(html);
  $("script, style, noscript, svg, nav, footer, form, iframe").remove();

  const title = $("title").first().text().trim() || $("h1").first().text().trim();
  const root = $("main, article").first().length ? $("main, article").first() : $("body");
  const sections: ExtractedSection[] = [];
  let heading = title || undefined;
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join("\n").replace(/\s+/g, " ").trim();
    if (content.length > 20) {
      sections.push({ content, section: heading, sourceUrl });
    }
    buffer = [];
  };

  root.find("h1, h2, h3, h4, p, li, pre, blockquote, table").each((_, element) => {
    const tag = element.tagName.toLowerCase();
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (!text) return;

    if (/^h[1-4]$/.test(tag)) {
      flush();
      heading = text;
    } else {
      buffer.push(text);
    }
  });
  flush();

  const base = new URL(sourceUrl);
  const discoveredLinks = root
    .find("a[href]")
    .map((_, element) => {
      try {
        const url = new URL($(element).attr("href")!, base);
        url.hash = "";
        return url.origin === base.origin ? url.toString() : null;
      } catch {
        return null;
      }
    })
    .get()
    .filter((value): value is string => Boolean(value));

  return {
    title,
    sections,
    discoveredLinks: [...new Set(discoveredLinks)],
  };
}
