import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/auth/permissions";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isKnowledgeManagementEnabled()) return new NextResponse(null, { status: 404 });
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const job = await prisma.knowledgeIngestionJob.findUnique({ where: { id } });
  return job
    ? NextResponse.json({ job })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
