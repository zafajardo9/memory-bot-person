import { NextResponse } from "next/server";

import {
  archiveKnowledgeSource,
  deleteKnowledgeSource,
  getKnowledgeSource,
} from "@/db/knowledge-queries";
import { getAuthenticatedUser } from "@/lib/auth/permissions";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const source = await getKnowledgeSource(id);
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    source: {
      ...source,
      currentVersion: source.currentVersion
        ? {
            ...source.currentVersion,
            originalContent: undefined,
            extractedText: source.currentVersion.extractedText?.slice(0, 20_000),
          }
        : null,
      versions: source.versions.map((version) => ({
        ...version,
        originalContent: undefined,
        extractedText: version.extractedText?.slice(0, 2_000),
      })),
    },
  });
}

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const source = await getKnowledgeSource(id);
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "ADMIN" && source.createdById !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ source: await archiveKnowledgeSource(id, user.id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to archive source" },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const source = await getKnowledgeSource(id);
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "ADMIN" && source.createdById !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await deleteKnowledgeSource(id, user.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete source" },
      { status: 400 },
    );
  }
}
