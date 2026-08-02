import { z } from "zod";

export const MAX_KNOWLEDGE_FILE_SIZE = 8 * 1024 * 1024;
export const MAX_URL_RESPONSE_SIZE = 3 * 1024 * 1024;
export const MAX_EXTRACTED_TEXT_SIZE = 2_000_000;

export const supportedKnowledgeMimeTypes = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const createUrlKnowledgeSchema = z.object({
  title: z.string().trim().min(2).max(200),
  url: z.string().trim().url().max(2_000),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  crawlDepth: z.number().int().min(0).max(2).default(0),
  crawlLimit: z.number().int().min(1).max(20).default(1),
});

export const createFileKnowledgeSchema = z.object({
  title: z.string().trim().min(2).max(200),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});

export const createNoteKnowledgeSchema = z.object({
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().min(10).max(100_000),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});

export const knowledgeSearchSchema = z.object({
  query: z.string().trim().min(2).max(1_000),
  limit: z.number().int().min(1).max(10).default(8),
});

export function validateKnowledgeFile(file: File) {
  if (file.size === 0) {
    throw new Error("The knowledge file is empty");
  }

  if (file.size > MAX_KNOWLEDGE_FILE_SIZE) {
    throw new Error("Knowledge files must be 8 MB or smaller");
  }

  if (!supportedKnowledgeMimeTypes.includes(file.type as any)) {
    throw new Error("Supported knowledge files are Markdown, TXT, PDF, and DOCX");
  }
}

export function validateKnowledgeFileSignature(file: File, bytes: Uint8Array) {
  if (file.type === "application/pdf") {
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    if (signature !== "%PDF-") throw new Error("The uploaded file is not a valid PDF");
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    !(bytes[0] === 0x50 && bytes[1] === 0x4b)
  ) {
    throw new Error("The uploaded file is not a valid DOCX document");
  }
}
