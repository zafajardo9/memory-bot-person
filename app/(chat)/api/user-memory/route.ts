import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentForUser } from "@/db/agent-queries";
import {
  deleteUserMemory,
  MEMORY_CATEGORIES,
  queryUserMemories,
  saveUserMemory,
} from "@/db/memory-queries";
import { getAuthenticatedUser } from "@/lib/auth/permissions";

const memorySchema = z.object({
  agentId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(4000),
  category: z.enum(MEMORY_CATEGORIES).default("fact"),
  priority: z.number().int().min(0).max(10).default(5),
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(10)
    .default([]),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
});

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentId = new URL(request.url).searchParams.get("agentId");
  if (!agentId || !(await getAgentForUser(agentId, user.id))) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }
  return NextResponse.json({
    memories: await queryUserMemories({ userId: user.id, agentId, limit: 200 }),
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const input = memorySchema.parse(await request.json());
    const memory = await saveUserMemory({
      userId: user.id,
      ...input,
      source: "manual",
    });
    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save memory.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, agentId } = deleteSchema.parse(await request.json());
    await deleteUserMemory(id, user.id, agentId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete memory.",
      },
      { status: 400 },
    );
  }
}
