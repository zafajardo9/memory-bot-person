import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/permissions";
import { isKnowledgeManagementEnabled } from "@/lib/knowledge/config";
import { getKnowledgeGaps } from "@/lib/knowledge/gaps";

export async function GET() {
  if (!isKnowledgeManagementEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gaps = await getKnowledgeGaps();
  return NextResponse.json({ gaps });
}
