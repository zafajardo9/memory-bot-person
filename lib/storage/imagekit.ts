import "server-only";

import ImageKit from "@imagekit/nodejs";

let _client: ImageKit | null = null;
let _configured: boolean | null = null;

function getClient(): ImageKit | null {
  if (_configured === null) {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (privateKey && privateKey.trim().length > 0) {
      _client = new ImageKit({ privateKey: privateKey.trim() });
      _configured = true;
    } else {
      _configured = false;
    }
  }
  return _client;
}

export function isImageKitConfigured(): boolean {
  getClient();
  return _configured === true;
}

export function getImageKitUrlEndpoint(): string {
  return (process.env.IMAGEKIT_URL_ENDPOINT ?? "").replace(/\/+$/, "");
}

export function getImageKitKnowledgeFolder(): string {
  const folder = (process.env.IMAGEKIT_KNOWLEDGE_FOLDER ?? "/knowledge").replace(
    /\/+$/,
    "",
  );
  return folder.startsWith("/") ? folder : `/${folder}`;
}

export interface ImageKitUploadResult {
  fileId: string;
  url: string;
  filePath: string;
}

export async function uploadKnowledgeFile(
  fileName: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<ImageKitUploadResult> {
  const client = getClient();
  if (!client) throw new Error("ImageKit is not configured");

  const folder = getImageKitKnowledgeFolder();
  const safeName = fileName.replace(/\s+/g, "_");

  // Wrap as a Buffer to satisfy strict ArrayBuffer typing.
  const file = new File([Buffer.from(bytes)], safeName, { type: mimeType });

  const response = await client.files.upload({
    file,
    fileName: safeName,
    folder,
    useUniqueFileName: true,
  });

  if (!response.fileId || !response.url || !response.filePath) {
    throw new Error("ImageKit upload returned incomplete response");
  }

  return {
    fileId: response.fileId,
    url: response.url,
    filePath: response.filePath,
  };
}

export async function downloadKnowledgeFile(fileId: string): Promise<Uint8Array> {
  const client = getClient();
  if (!client) throw new Error("ImageKit is not configured");

  const file = await client.files.get(fileId);
  if (!file.url) {
    throw new Error(`ImageKit file ${fileId} has no accessible URL`);
  }

  const response = await fetch(file.url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ImageKit file ${fileId}: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function deleteKnowledgeFile(fileId: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error("ImageKit is not configured");

  await client.files.delete(fileId);
}
