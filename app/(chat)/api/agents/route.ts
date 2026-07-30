import { NextResponse } from "next/server";

import { createAgent, listAgents } from "@/db/agent-queries";
import { createAgentSchema } from "@/lib/agents";
import { getAuthenticatedUser } from "@/lib/auth/permissions";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ agents: await listAgents(user.id) });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = createAgentSchema.parse(await request.json());
    return NextResponse.json(
      { agent: await createAgent(user.id, input) },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create agent.",
      },
      { status: 400 },
    );
  }
}
