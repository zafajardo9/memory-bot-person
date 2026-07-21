import { NextResponse } from "next/server";

import { listProviderStatuses } from "@/ai/providers/service";
import { getAdminUser } from "@/lib/auth/permissions";

export async function GET() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    providers: await listProviderStatuses(),
    canConfigure: user.role === "ADMIN",
  });
}
