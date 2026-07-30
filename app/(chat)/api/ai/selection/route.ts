import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAIProviderCatalog,
  saveUserAISelection,
} from "@/ai/providers/service";
import { getAuthenticatedUser } from "@/lib/auth/permissions";

const selectionSchema = z.object({
  providerId: z.string().trim().min(1).max(50),
  modelId: z.string().trim().min(1).max(200),
});

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agentId = new URL(request.url).searchParams.get("agentId") ?? undefined;
  return NextResponse.json(
    await getAIProviderCatalog(user.id, user.role === "ADMIN", agentId),
  );
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const selection = selectionSchema.parse(body);
    const agentId =
      typeof body.agentId === "string" ? body.agentId : undefined;
    return NextResponse.json({
      selection: await saveUserAISelection(user.id, selection, agentId),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to select model" },
      { status: 400 },
    );
  }
}
