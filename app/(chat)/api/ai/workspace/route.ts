import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getWorkspaceAISettings,
  saveWorkspaceAISelections,
  saveWorkspaceResearchSelection,
} from "@/ai/providers/research-settings";
import { getAuthenticatedUser } from "@/lib/auth/permissions";

const researchSelectionSchema = z.object({
  providerId: z.string().trim().min(1).max(50),
  modelId: z.string().trim().min(1).max(200),
});
const workspaceSelectionsSchema = z.object({
  thinkingSelection: researchSelectionSchema,
  humanizerSelection: researchSelectionSchema.nullable(),
});

async function adminUser() {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  if (!(await adminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await getWorkspaceAISettings());
}

export async function PUT(request: Request) {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const parsed = workspaceSelectionsSchema.safeParse(body);
    if (parsed.success) {
      return NextResponse.json(
        await saveWorkspaceAISelections(parsed.data, user.id),
      );
    }
    const legacySelection = researchSelectionSchema.parse(body);
    return NextResponse.json(
      await saveWorkspaceResearchSelection(legacySelection, user.id),
    );
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(", ")
        : error instanceof Error
          ? error.message
          : "Unable to save research model settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
