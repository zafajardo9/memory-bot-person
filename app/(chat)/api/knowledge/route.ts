import { after, NextResponse } from "next/server";

import {
  createFileKnowledgeSource,
  createNoteKnowledgeSource,
  createUrlKnowledgeSource,
  listKnowledgeSources,
} from "@/db/knowledge-queries";
import { getAuthenticatedUser } from "@/lib/auth/permissions";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";
import { processKnowledgeJob } from "@/lib/knowledge/ingestion";
import {
  assertKnowledgeSourceCapacity,
  getKnowledgeUsage,
} from "@/lib/knowledge/limits";
import { assertKnowledgeWriteRateLimit } from "@/lib/knowledge/rate-limit";
import { validatePublicUrl } from "@/lib/knowledge/url-security";
import {
  createFileKnowledgeSchema,
  createNoteKnowledgeSchema,
  createUrlKnowledgeSchema,
  validateKnowledgeFile,
  validateKnowledgeFileSignature,
} from "@/lib/knowledge/validation";

function parseTags(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function GET() {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [sources, usage] = await Promise.all([
    listKnowledgeSources(),
    getKnowledgeUsage(),
  ]);
  return NextResponse.json({ sources, usage });
}

export async function POST(request: Request) {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await assertKnowledgeWriteRateLimit(user.id);
    await assertKnowledgeSourceCapacity();
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "A knowledge file is required" }, { status: 400 });
      }
      validateKnowledgeFile(file);
      const parsed = createFileKnowledgeSchema.parse({
        title: form.get("title") || file.name,
        tags: parseTags(form.get("tags")),
      });
      const bytes = new Uint8Array(await file.arrayBuffer());
      validateKnowledgeFileSignature(file, bytes);
      const created = await createFileKnowledgeSource({
        ...parsed,
        mimeType: file.type,
        bytes,
        createdById: user.id,
      });
      after(() => processKnowledgeJob(created.job.id));
      return NextResponse.json({ source: created.source, job: created.job }, { status: 202 });
    }

    const body = await request.json();
    if (body.type === "NOTE") {
      const parsed = createNoteKnowledgeSchema.parse(body);
      const created = await createNoteKnowledgeSource({ ...parsed, createdById: user.id });
      after(() => processKnowledgeJob(created.job.id));
      return NextResponse.json({ source: created.source, job: created.job }, { status: 202 });
    }

    const parsed = createUrlKnowledgeSchema.parse(body);
    const url = await validatePublicUrl(parsed.url);
    const created = await createUrlKnowledgeSource({
      ...parsed,
      canonicalUrl: url.toString(),
      createdById: user.id,
    });
    after(() => processKnowledgeJob(created.job.id));
    return NextResponse.json({ source: created.source, job: created.job }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create knowledge source";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
