import mammoth from "mammoth";

import { extractStructuredText } from "./text";

import type { ExtractedDocument } from "../types";

export async function extractDocx(bytes: Uint8Array, sourceUrl?: string): Promise<ExtractedDocument> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  const document = extractStructuredText(result.value, sourceUrl);

  return {
    ...document,
    metadata: {
      warnings: result.messages.length,
    },
  };
}
