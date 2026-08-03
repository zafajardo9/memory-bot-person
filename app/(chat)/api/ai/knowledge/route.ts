import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/permissions";
import {
  getKnowledgeAISettings,
  saveKnowledgeAISelection,
} from "@/lib/knowledge/embedding-settings";

const knowledgeSelectionSchema = z.object({
  providerId: z.enum(["google", "openai"]),
  modelId: z.string().trim().min(1).max(200),
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
  return NextResponse.json(await getKnowledgeAISettings());
}

export async function PUT(request: Request) {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const selection = knowledgeSelectionSchema.parse(await request.json());
    return NextResponse.json(
      await saveKnowledgeAISelection(selection, user.id),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save knowledge processing settings.",
      },
      { status: 400 },
    );
  }
}
