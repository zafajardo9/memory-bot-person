import { NextResponse } from "next/server";
import { z } from "zod";

import { approveKnowledgeVersion, getKnowledgeSource } from "@/db/knowledge-queries";
import { getAuthenticatedUser } from "@/lib/auth/permissions";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";

const schema = z.object({ versionId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const { versionId } = schema.parse(await request.json());
    const source = await getKnowledgeSource(id);
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "ADMIN" && source.createdById !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      source: await approveKnowledgeVersion(id, versionId, user.id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to approve version" },
      { status: 400 },
    );
  }
}
