import { NextResponse } from "next/server";
import { z } from "zod";

import { approveKnowledgeVersion } from "@/db/knowledge-queries";
import { getAdminUser } from "@/lib/auth/permissions";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";

const schema = z.object({ versionId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const { versionId } = schema.parse(await request.json());
    return NextResponse.json({
      source: await approveKnowledgeVersion(id, versionId, admin.id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to approve version" },
      { status: 400 },
    );
  }
}
