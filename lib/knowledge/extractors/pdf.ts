import type { ExtractedDocument } from "../types";

export async function extractPdf(bytes: Uint8Array, sourceUrl?: string): Promise<ExtractedDocument> {
  // Keep PDF.js out of the knowledge route's module-evaluation path. Besides
  // reducing work for non-PDF requests, this lets the externalized Node
  // package initialize its DOMMatrix canvas polyfill before PDFParse is used.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });

  try {
    const result = await parser.getText();
    return {
      sections: result.pages
        .map((page) => ({
          content: page.text.trim(),
          section: `Page ${page.num}`,
          pageNumber: page.num,
          sourceUrl,
        }))
        .filter((page) => page.content.length > 0),
      metadata: { pageCount: result.total },
    };
  } finally {
    await parser.destroy();
  }
}
