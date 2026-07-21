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

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    await getAIProviderCatalog(user.id, user.role === "ADMIN"),
  );
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const selection = selectionSchema.parse(await request.json());
    return NextResponse.json({
      selection: await saveUserAISelection(user.id, selection),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to select model" },
      { status: 400 },
    );
  }
}
