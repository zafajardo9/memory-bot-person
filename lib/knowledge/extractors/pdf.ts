import { PDFParse } from "pdf-parse";

import type { ExtractedDocument } from "../types";

export async function extractPdf(bytes: Uint8Array, sourceUrl?: string): Promise<ExtractedDocument> {
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
