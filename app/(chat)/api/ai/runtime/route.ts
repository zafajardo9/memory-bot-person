import { NextResponse } from "next/server";
import { z } from "zod";

import { getWorkspaceAIRuntimeStatus } from "@/ai/providers/research-settings";
import { getAuthenticatedUser } from "@/lib/auth/permissions";

const querySchema = z.object({
  agentId: z.string().uuid(),
});

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const query = querySchema.parse({
      agentId: new URL(request.url).searchParams.get("agentId"),
    });
    return NextResponse.json(
      await getWorkspaceAIRuntimeStatus(user.id, query.agentId),
    );
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join(", ")
        : error instanceof Error
          ? error.message
          : "Unable to resolve workspace AI.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
