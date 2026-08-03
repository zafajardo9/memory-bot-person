import { after, NextResponse } from "next/server";

import { createRescanJob, getKnowledgeSource } from "@/db/knowledge-queries";
import { getAuthenticatedUser } from "@/lib/auth/permissions";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";
import { processKnowledgeJob } from "@/lib/knowledge/ingestion";
import { assertKnowledgeWriteRateLimit } from "@/lib/knowledge/rate-limit";
import {
  validateKnowledgeFile,
  validateKnowledgeFileSignature,
} from "@/lib/knowledge/validation";
import { withTransientRetry } from "@/lib/prisma";

// Ingestion runs post-response in `after()`; 60s keeps it under the Hobby plan
// hard kill while Pro honors up to 300s.
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await assertKnowledgeWriteRateLimit(user.id);
    const { id } = await params;
    const source = await withTransientRetry(() => getKnowledgeSource(id));
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "ADMIN" && source.createdById !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let replacement: { bytes: Uint8Array; mimeType: string } | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      if (source.type !== "FILE") throw new Error("Only file memories accept file replacements");
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("A replacement file is required");
      validateKnowledgeFile(file);
      const bytes = new Uint8Array(await file.arrayBuffer());
      validateKnowledgeFileSignature(file, bytes);
      replacement = { bytes, mimeType: file.type };
    } else if (contentType.includes("application/json")) {
      if (source.type !== "NOTE") throw new Error("Only notes can be updated with text");
      const body = await request.json();
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (content.length < 10 || content.length > 100_000) {
        throw new Error("Notes must contain between 10 and 100,000 characters");
      }
      replacement = { bytes: new TextEncoder().encode(content), mimeType: "text/markdown" };
    }
    const created = await createRescanJob(id, user.id, replacement);
    after(() => processKnowledgeJob(created.job.id));
    return NextResponse.json({ job: created.job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to rescan source" },
      { status: 400 },
    );
  }
}
